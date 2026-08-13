import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsdoc from "eslint-plugin-jsdoc";

// Enforces the boundaries described in docs/conventions/architecture.md.
// Flat config note: when two blocks set the same rule for one file, the later
// block replaces the earlier one, so each block lists its complete set.

const noFramework = {
  group: [
    "react",
    "react-dom",
    "react/*",
    "react-dom/*",
    "next",
    "next/*",
    "server-only",
    "client-only",
  ],
  message:
    "The domain layer must not know about React or Next.js. Keep framework concerns in app/ and components/.",
};

const noUpperLayers = {
  group: [
    "@/app/*",
    "@/app/**",
    "@/components/*",
    "@/components/**",
    "@/hooks/*",
    "@/hooks/**",
  ],
  message:
    "Dependencies point inward. lib/ must not import from app/, components/ or hooks/.",
};

const noDatabaseInternals = {
  group: [
    "@prisma/client",
    "@prisma/client/*",
    "@prisma/adapter-pg",
    "pg",
    "@/lib/generated/*",
    "@/lib/generated/**",
  ],
  message:
    "Import the shared client from @/lib/db. Only lib/db.ts may construct a Prisma client.",
};

const noAnthropicSdk = {
  group: ["@anthropic-ai/sdk", "@anthropic-ai/sdk/*"],
  message:
    "Every Anthropic call goes through lib/services/llm.ts, so the provider stays replaceable.",
};

const noServerCode = {
  group: [
    "@/lib/services/*",
    "@/lib/services/**",
    "@/lib/db",
    "@/lib/env",
    "@prisma/client",
    "pg",
  ],
  message:
    "This is client-reachable code. Data arrives as props from a server component or through a server action.",
};

const restrictImports = (...patterns) => [
  "error",
  { patterns: patterns.flat() },
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "lib/generated/**",
  ]),

  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictImports(
        noDatabaseInternals,
        noAnthropicSdk,
      ),
    },
  },

  {
    files: ["components/**/*.{ts,tsx}", "hooks/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": restrictImports(
        noDatabaseInternals,
        noAnthropicSdk,
        noServerCode,
      ),
    },
  },

  {
    files: ["lib/services/**/*.ts"],
    plugins: { jsdoc },
    rules: {
      "no-restricted-imports": restrictImports(
        noDatabaseInternals,
        noAnthropicSdk,
        noFramework,
        noUpperLayers,
      ),
      "no-restricted-globals": [
        "error",
        {
          name: "Request",
          message:
            "Services take typed arguments, not HTTP objects. Parse the request in the route handler and pass values in.",
        },
        {
          name: "Response",
          message:
            "Services return typed values. Shaping the HTTP response is the route handler's job.",
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "ExportDefaultDeclaration",
          message:
            "Services export named functions, so imports stay greppable and refactors stay safe.",
        },
        {
          // no-restricted-globals only sees value usage, not type positions.
          selector:
            "TSTypeReference > Identifier[name=/^(Request|Response|Headers|NextRequest|NextResponse)$/]",
          message:
            "Services take typed arguments and return typed values, never HTTP objects.",
        },
      ],
      // The exported surface of a service is its contract, so it is documented.
      "jsdoc/require-jsdoc": [
        "error",
        {
          publicOnly: true,
          require: {
            FunctionDeclaration: true,
            FunctionExpression: true,
            ArrowFunctionExpression: true,
          },
        },
      ],
      "jsdoc/require-description": "error",
      "jsdoc/require-param": "error",
      "jsdoc/require-param-description": "error",
      "jsdoc/require-returns": "error",
      "jsdoc/require-returns-description": "error",
      "jsdoc/no-types": "error",
      "jsdoc/check-alignment": "error",
      "jsdoc/check-param-names": "error",
    },
  },

  {
    files: ["lib/services/llm.ts"],
    rules: {
      "no-restricted-imports": restrictImports(
        noDatabaseInternals,
        noFramework,
        noUpperLayers,
      ),
    },
  },

  {
    files: ["lib/schemas/**/*.ts"],
    rules: {
      "no-restricted-imports": restrictImports(
        noDatabaseInternals,
        noAnthropicSdk,
        noFramework,
        noUpperLayers,
        noServerCode,
      ),
      "no-restricted-syntax": [
        "error",
        {
          selector:
            ":matches(Property, TSPropertySignature)[key.name='actorId']",
          message:
            "`actorId` means an identity already verified by the caller. A schema validates data from the network, so an actorId here is a lie and an IDOR waiting to happen. Read it from the session instead.",
        },
      ],
    },
  },

  {
    files: ["lib/db.ts"],
    rules: {
      "no-restricted-imports": restrictImports(noAnthropicSdk),
    },
  },

  {
    files: [
      "app/**/*.{ts,tsx}",
      "components/**/*.{ts,tsx}",
      "hooks/**/*.{ts,tsx}",
      "lib/**/*.{ts,tsx}",
    ],
    ignores: ["lib/env.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message:
            "Import the validated `env` from @/lib/env instead, so a missing variable fails at startup rather than at request time.",
        },
      ],
    },
  },
]);

export default eslintConfig;
