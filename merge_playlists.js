const fs = require('fs');
const path = require('path');
const readline = require('readline');

const listsDir = path.join(__dirname, 'lists');
const outputFile = path.join(__dirname, 'merged.csv');

const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

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
	let mergedLines = [];

	// Riffle shuffle: iterate through lines, then through files
	for (let i = 0; i < maxLines; i++) {
		for (let j = 0; j < fileContents.length; j++) {
			const lines = fileContents[j];
			if (i < lines.length) {
				mergedLines.push(lines[i]);
			}
		}
	}

	rl.question(
		'Should duplicates be removed or kept? (remove/keep): ',
		(answer) => {
			const shouldRemove = answer.trim().toLowerCase() === 'remove';

			if (shouldRemove) {
				const uniqueLines = new Set();
				const filteredLines = [];

				mergedLines.forEach((line) => {
					if (!uniqueLines.has(line)) {
						uniqueLines.add(line);
						filteredLines.push(line);
					}
				});
				mergedLines = filteredLines;
				console.log('Duplicates removed.');
			} else {
				console.log('Duplicates kept.');
			}

			// Add header back at the top
			if (header) {
				mergedLines.unshift(header);
			}

			// Write the result to merged.csv
			fs.writeFileSync(outputFile, mergedLines.join('\n'));
			console.log(
				`Successfully merged ${mergedLines.length} lines into ${outputFile}`
			);

			rl.close();
		}
	);
} catch (err) {
	console.error('An error occurred:', err);
	rl.close();
}
