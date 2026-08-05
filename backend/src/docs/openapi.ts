/**
 * Hand-written OpenAPI 3.0 spec for the Phase 1 (auth + workspace bootstrap)
 * API surface. The endpoint count is small enough that maintaining this by
 * hand is simpler and more reliable than a jsdoc-comment generator - update
 * it alongside auth.routes.ts/workspace.routes.ts as new endpoints land in
 * later migration phases.
 *
 * Every response uses the envelope defined in lib/apiResponse.ts. The
 * `Success`/`Error` component schemas below describe it once; individual
 * endpoints reference them and describe only what sits inside `data`.
 */
export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "ShopCore API",
    version: "0.1.0",
    description:
      "Custom backend replacing Supabase, module by module. This phase covers authentication and workspace/tenant bootstrap.\n\n" +
      "**Response envelope** - every endpoint, success or failure, answers with the same shape:\n\n" +
      "```json\n" +
      '{ "success": true,  "message": "Signed in successfully.", "data": { } }\n' +
      '{ "success": false, "message": "Invalid email or password.", "error": { "code": "invalid_credentials" } }\n' +
      "```\n\n" +
      "**Languages** - `message` is translated server-side. Choose a language with the `X-Language` " +
      "header, a `?lang=` query parameter, or standard `Accept-Language` negotiation. Supported: " +
      "`en`, `fr`, `es`, `sw`, `rw`. The negotiated language is echoed in the `Content-Language` " +
      "response header.",
  },
  servers: [{ url: "/api" }],
  tags: [
    { name: "Auth", description: "Signup, login, session, password reset" },
    { name: "Workspace", description: "Tenant/workspace bootstrap and subscription plan catalog" },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    parameters: {
      LanguageHeader: {
        name: "X-Language",
        in: "header",
        required: false,
        description: "Language for the response `message`. Overridden by `?lang=`, overrides `Accept-Language`.",
        schema: { type: "string", enum: ["en", "fr", "es", "sw", "rw"] },
      },
    },
    schemas: {
      Success: {
        type: "object",
        required: ["success", "message", "data"],
        properties: {
          success: { type: "boolean", enum: [true] },
          message: {
            type: "string",
            description: "Human-readable outcome, already translated. Safe to show a user verbatim.",
            example: "Signed in successfully.",
          },
          data: {
            nullable: true,
            description: "Endpoint payload, or null for endpoints that return no body.",
          },
        },
      },
      Error: {
        type: "object",
        required: ["success", "message", "error"],
        properties: {
          success: { type: "boolean", enum: [false] },
          message: {
            type: "string",
            description: "Human-readable explanation, already translated.",
            example: "An account with this email already exists.",
          },
          error: {
            type: "object",
            required: ["code"],
            properties: {
              code: {
                type: "string",
                description: "Stable machine-readable identifier; branch on this, not on the message.",
                example: "invalid_credentials",
              },
              details: {
                description: "Present on validation failures: Zod `flatten()` output with per-field errors.",
                example: { formErrors: [], fieldErrors: { email: ["Invalid email"] } },
              },
            },
          },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          email: { type: "string", format: "email" },
          displayName: { type: "string", nullable: true },
        },
      },
      AuthTokens: {
        type: "object",
        properties: {
          accessToken: { type: "string" },
          refreshToken: { type: "string" },
        },
      },
    },
  },
  paths: {
    "/health": {
      get: {
        tags: ["Auth"],
        summary: "Liveness check",
        responses: { "200": { description: "OK" } },
      },
    },
    "/auth/signup": {
      post: {
        tags: ["Auth"],
        summary: "Create an account and its workspace (tenant) in one call",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password", "displayName", "businessName", "planCode", "billingCycle"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 },
                  displayName: { type: "string", description: "Plaintext over TLS; encrypted server-side with AES-256-GCM before storage" },
                  businessName: { type: "string" },
                  businessPhone: { type: "string", description: "Plaintext over TLS; encrypted server-side with AES-256-GCM before storage" },
                  businessLocation: { type: "string" },
                  businessType: { type: "string" },
                  teamSize: { type: "string" },
                  language: { type: "string", enum: ["en", "fr", "rw", "sw"] },
                  planCode: { type: "string", example: "starter" },
                  billingCycle: { type: "string", enum: ["monthly", "six_months", "annual"] },
                  paymentMethod: { type: "string", description: "PaymentMethod.code, see GET /workspace/payment-methods" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Account and workspace created",
            content: {
              "application/json": {
                schema: {
                  allOf: [
                    { $ref: "#/components/schemas/AuthTokens" },
                    {
                      type: "object",
                      properties: {
                        user: { $ref: "#/components/schemas/User" },
                        tenantId: { type: "string", format: "uuid" },
                      },
                    },
                  ],
                },
              },
            },
          },
          "409": { description: "Email already in use", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Log in with email and password",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Logged in" },
          "401": { description: "Invalid credentials", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/auth/refresh": {
      post: {
        tags: ["Auth"],
        summary: "Exchange a refresh token for a new access/refresh pair (rotates the refresh token)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["refreshToken"], properties: { refreshToken: { type: "string" } } },
            },
          },
        },
        responses: {
          "200": { description: "New token pair", content: { "application/json": { schema: { $ref: "#/components/schemas/AuthTokens" } } } },
          "401": { description: "Invalid or expired refresh token" },
        },
      },
    },
    "/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Revoke a refresh token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["refreshToken"], properties: { refreshToken: { type: "string" } } },
            },
          },
        },
        responses: { "204": { description: "Logged out" } },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get the current user, tenant, role, and subscription in one call",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Session summary" },
          "401": { description: "Missing or invalid access token" },
        },
      },
    },
    "/auth/is-platform-admin": {
      get: {
        tags: ["Auth"],
        summary: "Check whether the current user is a platform (super-admin) account",
        security: [{ bearerAuth: [] }],
        responses: { "200": { description: "isPlatformAdmin flag" } },
      },
    },
    "/auth/password-reset/request": {
      post: {
        tags: ["Auth"],
        summary: "Request a password reset email (always 202, does not reveal whether the account exists)",
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", required: ["email"], properties: { email: { type: "string", format: "email" } } } } },
        },
        responses: { "202": { description: "Accepted" } },
      },
    },
    "/auth/password-reset/complete": {
      post: {
        tags: ["Auth"],
        summary: "Complete a password reset using the emailed token",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token", "newPassword"],
                properties: { token: { type: "string" }, newPassword: { type: "string", minLength: 8 } },
              },
            },
          },
        },
        responses: {
          "200": { description: "Password updated" },
          "400": { description: "Invalid or expired token" },
        },
      },
    },
    "/workspace/plans": {
      get: {
        tags: ["Workspace"],
        summary: "List the public subscription plan catalog",
        responses: { "200": { description: "Plan catalog" } },
      },
    },
    "/workspace/payment-methods": {
      get: {
        tags: ["Workspace"],
        summary: "List active payment methods (mobile money, card, bank transfer, ...)",
        responses: { "200": { description: "Payment methods" } },
      },
    },
    "/workspace/pending": {
      post: {
        tags: ["Workspace"],
        summary: "Create a pending workspace/tenant for the current user (also called internally by signup)",
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Workspace created or already existed", content: { "application/json": { schema: { type: "object", properties: { tenantId: { type: "string", format: "uuid" } } } } } },
          "400": { description: "Invalid plan/billing cycle/payment method" },
        },
      },
    },
  },
};
