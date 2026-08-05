/**
 * Hand-written OpenAPI 3.0 spec for the Phase 1 (auth + workspace bootstrap)
 * API surface. The endpoint count is small enough that maintaining this by
 * hand is simpler and more reliable than a jsdoc-comment generator - update
 * it alongside auth.routes.ts/workspace.routes.ts as new endpoints land in
 * later migration phases.
 */
export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "ShopCore API",
    version: "0.1.0",
    description:
      "Custom backend replacing Supabase, module by module. This phase covers authentication and workspace/tenant bootstrap.",
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
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: {
            type: "object",
            properties: {
              code: { type: "string" },
              message: { type: "string" },
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
