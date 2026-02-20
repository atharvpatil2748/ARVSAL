const path = require("path");
const fs = require("fs");
const os = require("os");
const { PDFDocument } = require("pdf-lib");
// 🔥 FIX: Added .default to resolve the constructor error
const PDFMerger = require("pdf-merger-js").default; 
const libre = require("libreoffice-convert");
const { promisify } = require("util");
const lib_convert = promisify(libre.convert);

class ConversionEngine {
    constructor() {
        this.sessions = {}; 
    }

    startSession(sessionId) {
        const workspace = path.join(os.tmpdir(), `arvsal_batch_${sessionId}_${Date.now()}`);
        if (!fs.existsSync(workspace)) fs.mkdirSync(workspace, { recursive: true });
        this.sessions[sessionId] = { path: workspace, files: [], status: "COLLECTING" };
        return workspace;
    }

    async addFile(sessionId, fileName, buffer) {
        if (!this.sessions[sessionId]) return;
        const filePath = path.join(this.sessions[sessionId].path, fileName);
        fs.writeFileSync(filePath, buffer);
        this.sessions[sessionId].files.push(filePath);
    }

    async finalize(sessionId, customName) {
        const session = this.sessions[sessionId];
        if (!session) throw new Error("No active session.");

        const merger = new PDFMerger();
        // Ensure the filename has .pdf
        const finalPdfName = customName.toLowerCase().endsWith(".pdf") ? customName : `${customName}.pdf`;
        const finalPdfPath = path.join(os.tmpdir(), finalPdfName);

        for (const filePath of session.files) {
            const ext = path.extname(filePath).toLowerCase();
            let pdfToMerge = null;

            // 1. Convert Images
            if ([".jpg", ".jpeg", ".png"].includes(ext)) {
                pdfToMerge = await this.imageToPdf(filePath);
            } 
            // 2. Convert Office Docs
            else if ([".docx", ".xlsx", ".txt", ".pptx"].includes(ext)) {
                pdfToMerge = await this.officeToPdf(filePath);
            }
            // 3. Handle existing PDFs 🔥 (NEW LOGIC)
            else if (ext === ".pdf") {
                pdfToMerge = filePath;
            }

            // Add to Merger
            if (pdfToMerge && fs.existsSync(pdfToMerge)) {
                await merger.add(pdfToMerge);
            }
        }

        await merger.save(finalPdfPath);
        this.cleanup(sessionId);
        return finalPdfPath;
    }


    async imageToPdf(imgPath) {
        const pdfDoc = await PDFDocument.create();
        const imgBytes = fs.readFileSync(imgPath);
        const ext = path.extname(imgPath).toLowerCase();
        
        let image = (ext === ".png") ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes);

        // 🔥 FIX: Explicitly set the page size to the image size
        const { width, height } = image.scale(1); 
        const page = pdfDoc.addPage([width, height]);
        
        page.drawImage(image, {
            x: 0,
            y: 0,
            width: width,
            height: height,
        });
        
        const pdfPath = imgPath + ".pdf";
        fs.writeFileSync(pdfPath, await pdfDoc.save());
        return pdfPath;
    }



    async officeToPdf(officePath) {
        const docBuffer = fs.readFileSync(officePath);
        const pdfPath = officePath + ".pdf";
        const pdfBuffer = await lib_convert(docBuffer, ".pdf", undefined);
        fs.writeFileSync(pdfPath, pdfBuffer);
        return pdfPath;
    }

    cleanup(sessionId) {
        if (this.sessions[sessionId]) {
            try {
                fs.rmSync(this.sessions[sessionId].path, { recursive: true, force: true });
            } catch (err) {
                console.error("Cleanup error:", err);
            }
            delete this.sessions[sessionId];
        }
    }
}

module.exports = new ConversionEngine();
