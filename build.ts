import { bundle } from "https://deno.land/x/emit@0.40.0/mod.ts"; // Using emit module for bundling
import * as path from "https://deno.land/std@0.224.0/path/mod.ts";
import { toFileUrl } from "https://deno.land/std@0.224.0/path/mod.ts"; // Import toFileUrl

const __dirname = path.dirname(path.fromFileUrl(import.meta.url));
const srcDir = path.join(__dirname, "src");
const mainTsPath = path.join(srcDir, "main.ts");
const styleCssPath = path.join(srcDir, "style.css");
const templateHtmlPath = path.join(__dirname, "index.html");
const outputHtmlPath = path.join(__dirname, "csv_date_expander.html");

async function build() {
    console.log("Starting build process...");

    // 1. Read CSS content
    console.log(`Reading CSS from ${styleCssPath}...`);
    let cssContent = "";
    try {
        cssContent = await Deno.readTextFile(styleCssPath);
        console.log("CSS read successfully.");
    } catch (error) {
        console.error(`Error reading CSS file: ${error.message}`);
        Deno.exit(1);
    }

    // 2. Bundle TypeScript to JavaScript
    console.log(`Bundling TypeScript from ${mainTsPath}...`);
    let jsContent = "";
    try {
        const result = await bundle(
            toFileUrl(mainTsPath), // Use path.toFileUrl to ensure correct URL format
            {
                // Options for bundling if needed, e.g., compilerOptions
                // compilerOptions: { lib: ["dom", "esnext"] }
            }
        );
        jsContent = result.code;
        console.log("TypeScript bundled successfully.");
    } catch (error) {
        console.error(`Error bundling TypeScript: ${error.message}`);
        Deno.exit(1);
    }


    // 3. Read HTML template content
    console.log(`Reading HTML template from ${templateHtmlPath}...`);
    let htmlTemplate = "";
    try {
        htmlTemplate = await Deno.readTextFile(templateHtmlPath);
        console.log("HTML template read successfully.");
    } catch (error) {
        console.error(`Error reading HTML template: ${error.message}`);
        Deno.exit(1);
    }

    // 4. Inject CSS and JavaScript into the template
    console.log("Injecting CSS and JavaScript into HTML...");
    // Replace CSS link with inline style tag
    let finalHtml = htmlTemplate.replace(
        /<link rel="stylesheet" href=".\/src\/style.css">/,
        `<style>\n${cssContent}\n</style>`
    );
    // Replace JS script tag with inline script tag
    finalHtml = finalHtml.replace(
        /<script type="module" src=".\/src\/main.js"><\/script>/,
        // Use type="module" for potential top-level await or modern features
        `<script type="module">\n${jsContent}\n</script>`
    );

    // 5. Write the final HTML file
    console.log(`Writing final HTML to ${outputHtmlPath}...`);
    try {
        await Deno.writeTextFile(outputHtmlPath, finalHtml);
        console.log("Build completed successfully!");
        console.log(`Output file: ${outputHtmlPath}`);
    } catch (error) {
        console.error(`Error writing final HTML file: ${error.message}`);
        Deno.exit(1);
    }
}

// Run the build function
build();