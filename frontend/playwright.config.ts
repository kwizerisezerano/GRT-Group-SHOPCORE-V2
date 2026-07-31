import {
    defineConfig,
    devices,
} from "@playwright/test";

export default defineConfig({

    testDir: "./tests",

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