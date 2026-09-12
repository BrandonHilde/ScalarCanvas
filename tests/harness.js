class TestRunner {
    constructor() {
        this.tests = [];
        this.results = [];
    }

    test(name, fn) {
        this.tests.push({ name, fn });
    }

    async run(container) {
        container.innerHTML = "";
        let passed = 0;
        let failed = 0;

        for (const test of this.tests) {
            const row = document.createElement("div");
            row.className = "result";
            try {
                await test.fn();
                row.classList.add("pass");
                row.innerHTML = `<span class="badge">PASS</span> ${test.name}`;
                passed++;
            } catch (err) {
                row.classList.add("fail");
                row.innerHTML = `<span class="badge">FAIL</span> ${test.name}<pre>${escapeHtml(err && err.stack ? err.stack : String(err))}</pre>`;
                failed++;
            }
            container.appendChild(row);
        }

        const summary = document.createElement("div");
        summary.className = "summary " + (failed === 0 ? "pass" : "fail");
        summary.textContent = `${passed} passed, ${failed} failed`;
        container.prepend(summary);

        return { passed, failed };
    }
}

function escapeHtml(s) {
    return s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

const runner = new TestRunner();

function test(name, fn) {
    runner.test(name, fn);
}

function assert(condition, message = "assertion failed") {
    if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message = "") {
    if (actual !== expected) {
        throw new Error(`${message} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}

function assertClose(actual, expected, tolerance = 0.001, message = "") {
    if (Math.abs(actual - expected) > tolerance) {
        throw new Error(`${message} expected ~${expected}, got ${actual}`);
    }
}
