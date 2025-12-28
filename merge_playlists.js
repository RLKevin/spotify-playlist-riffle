const fs = require('fs');
const path = require('path');

const listsDir = path.join(__dirname, 'lists');
const outputFile = path.join(__dirname, 'merged.csv');

try {
	// Get all csv files from the lists directory
	const files = fs
		.readdirSync(listsDir)
		.filter((file) => file.endsWith('.csv'));

	if (files.length === 0) {
		console.log('No .csv files found in lists/ directory.');
		process.exit(0);
	}

	console.log(`Found ${files.length} files: ${files.join(', ')}`);

	// Read all files
	let header = '';
	const fileContents = files.map((file, index) => {
		const content = fs.readFileSync(path.join(listsDir, file), 'utf-8');
		// Split by newline, handling both Unix and Windows line endings
		// We filter out empty lines that might result from trailing newlines
		const lines = content.split(/\r?\n/).filter((line) => line.length > 0);

		if (index === 0 && lines.length > 0) {
			header = lines[0];
		}

		// Remove the header from each file
		if (lines.length > 0) {
			lines.shift();
		}
		return lines;
	});

	// Find the maximum number of lines in any file
	const maxLines = Math.max(...fileContents.map((lines) => lines.length));
	const mergedLines = [];

	if (header) {
		mergedLines.push(header);
	}

	// Riffle shuffle: iterate through lines, then through files
	for (let i = 0; i < maxLines; i++) {
		for (let j = 0; j < fileContents.length; j++) {
			const lines = fileContents[j];
			if (i < lines.length) {
				mergedLines.push(lines[i]);
			}
		}
	}

	// Write the result to merged.csv
	fs.writeFileSync(outputFile, mergedLines.join('\n'));
	console.log(
		`Successfully merged ${mergedLines.length} lines into ${outputFile}`
	);
} catch (err) {
	console.error('An error occurred:', err);
}
