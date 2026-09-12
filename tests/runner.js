const results = document.getElementById("results");
const status = document.getElementById("status");

async function run() {
    status.textContent = "Running…";
    const { passed, failed } = await runner.run(results);
    status.textContent = `${passed} passed, ${failed} failed`;
}

document.getElementById("rerun").addEventListener("click", run);

window.addEventListener("dragover", (e) => e.preventDefault());
window.addEventListener("drop", (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
        window.__realFontBuffer = reader.result;
        document.getElementById("dropped").textContent = "Loaded real font: " + file.name;
        run();
    };
    reader.readAsArrayBuffer(file);
});

run();
