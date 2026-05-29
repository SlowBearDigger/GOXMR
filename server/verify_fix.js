/**
 * Verification Script: botHoneypot Middleware
 * Checks if next() is called exactly once.
 */

let nextCallCount = 0;
const next = () => {
    nextCallCount++;
};

const req = {
    body: {
        website_id_verify: "",
        _bot_check: ""
    }
};

const res = {
    status: function (code) {
        this.statusCode = code;
        return this;
    },
    json: function (data) {
        this.data = data;
        return this;
    }
};

// Mock the middleware function from server/index.js
const botHoneypot = (req, res, next) => {
    const { website_id_verify, _bot_check } = req.body;
    if (website_id_verify || _bot_check) {
        // console.warn(`[DEFENSE] Honeypot triggered by IP: ${req.ip}. Likely bot activity.`);
        return res.status(400).json({ error: "Bad Request" });
    }
    next();
};

console.log("Testing botHoneypot with normal request...");
botHoneypot(req, res, next);
if (nextCallCount === 1) {
    console.log("SUCCESS: next() called exactly once.");
} else {
    console.error(`FAILURE: next() called ${nextCallCount} times.`);
    process.exit(1);
}

console.log("Testing botHoneypot with bot request...");
nextCallCount = 0;
const botReq = {
    body: {
        _bot_check: "I am a bot"
    }
};
botHoneypot(botReq, res, next);
if (nextCallCount === 0 && res.statusCode === 400) {
    console.log("SUCCESS: Bot blocked, next() never called.");
} else {
    console.error(`FAILURE: Bot behavior incorrect. next() count: ${nextCallCount}, status: ${res.statusCode}`);
    process.exit(1);
}

console.log("Verification COMPLETE.");
