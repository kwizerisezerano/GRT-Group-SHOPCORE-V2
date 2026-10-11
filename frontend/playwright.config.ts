import {
    defineConfig,
    devices,
} from "@playwright/test";

export default defineConfig({

    testDir: "./tests",

    /*
     * Mints the seeded sessions before every run. Access tokens live fifteen
     * minutes, so a fixtures file written earlier in the day is a signed-out
     * session — and the suite reports that as missing headings rather than as
     * an expired login. See tests/support/globalSetup.ts.
     */
    globalSetup: "./tests/support/globalSetup.ts",

    timeout: 60000,

    retries: 1,

    fullyParallel: true,

    reporter: [
        ["html"],
        ["list"],
    ],

    use: {

        baseURL: "http://127.0.0.1:5173",

        trace: "retain-on-failure",

        screenshot: "only-on-failure",

        video: "retain-on-failure",
    },

    webServer: {

        command: "npm run dev",

        url: "http://127.0.0.1:5173",

        reuseExistingServer: true,
    },

    projects: [

        {
            name: "chromium",

            use: {
                ...devices["Desktop Chrome"],
            },
        },

        {
            name: "firefox",

            use: {
                ...devices["Desktop Firefox"],
            },
        },

        {
            name: "webkit",

            use: {
                ...devices["Desktop Safari"],
            },
        },
    ],
});