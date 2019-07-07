let previous_settings = {};


/**
 * @returns Object Object holding information about settings.
 */
function getCurrentSettings() {
	return {
		a: {
			color: hexToRGB(document.getElementById('a-col').value),
			direction: document.getElementById('a-dir').value,
		},
		t: {
			color: hexToRGB(document.getElementById('t-col').value),
			direction: document.getElementById('t-dir').value,
		},
		g: {
			color: hexToRGB(document.getElementById('g-col').value),
			direction: document.getElementById('g-dir').value,
		},
		c: {
			color: hexToRGB(document.getElementById('c-col').value),
			direction: document.getElementById('c-dir').value,
		},
		x: {
			color: hexToRGB(document.getElementById('x-col').value),
			direction: document.getElementById('x-dir').value
		},

		plotly_type: 'scattergl',
		plotly_mode: document.getElementById('graph-mode').value,
		point_offset: parseInt(document.getElementById('offset').value),
		point_size: parseInt(document.getElementById('size').value),
		color_enabled: document.getElementById('color').checked,
		chunk_size: parseInt(document.getElementById('chunksize').value),
		input_file: document.getElementById('file').files[0]
	};
}


/**
 * Moves the cursor X and Y coordinates.
 * 
 * @param {string} direction 
 * In which direction the cursor should move. 
 * Either N, E, S, W or defaults to not moving the cursor.
 * 
 * @param {Object} cursor 
 * The cursor of which you want to change
 * @param {number} cursor.x X coordinate
 * @param {number} cursor.y Y coordinate 
 * 
 */
function moveCursor(direction, cursor) {
	switch (direction) {
		case 'N':
			cursor.y += 1;
			break;
		case 'E':
			cursor.x += 1;
			break;
		case 'S':
			cursor.y -= 1;
			break;
		case 'W':
			cursor.x -= 1;
			break;
		case 'NE':
			cursor.x += 1;
			cursor.y += 1;
			break;
		case 'NW':
			cursor.x -= 1;
			cursor.y += 1;
			break;
		case 'SE':
			cursor.x += 1;
			cursor.y -= 1;
			break;
		case 'SW':
			cursor.x -= 1;
			cursor.y -= 1;
			break;
		default:
			break;
	}
}


/**
 * Needs to be async because of File IO, FileReader
 */
async function newPlot() {
	const settings = getCurrentSettings();
	console.log("Settings:", settings);

	
	if(settings.input_file === undefined) {
		return alert("Error: No file was specified. Select a file before drawing.");
	}
	
	// since they will have the exact same order, we can easily compare strings
	// instead of a deep compare. We do however need to check the input_file manually
	// because they're not stringifyable!
	if(JSON.stringify(settings) === JSON.stringify(previous_settings)
	&& settings.input_file.name === previous_settings.input_file.name) {
		// Settings have not changed since last plot.
		if(confirm("Settings have not changed since last plot.\n\n- Cancel to do nothing\n- Confirm to redraw\n\nWhat do you want to do?") === false) {
			return;
		}
	} else {
		previous_settings = settings;
	}
	
	// Begin
	const start_date = new Date();
	console.log("Start plotting at", start_date);


	
	// Hide text, give the plot fullscreen height and scroll
	$('#unplotted-text').addClass('d-none');
	$('#plot').addClass('fullscreen');
	document.getElementById('progress-text').scrollIntoView(true);
	
	// 1000000 = 1 megabyte
	const chunk_size_mb = 1000000 * settings.chunk_size;
	let total_chunks = Math.ceil(settings.input_file.size / chunk_size_mb);
	let current_point = 0;
	console.log("There will be", total_chunks, "chunk/s.")
	
	// For Browser File IO
	const file_reader = new FileReader();
	
	// Data for graph
	const x_coords = [], y_coords = [];
	const colors = [[]]; // array in array because that's how plotly works
	const cursor = { x: 0, y: 0 };
	const plotly_data = [{
		type: settings.plotly_type,
		mode: settings.plotly_mode,
		marker: {
			size: settings.point_size,
			color: 'rgb(0, 0, 0)',
			// line: {
			// 	width: 1,
			// 	color: 'rgb(0,0,0)'}
		},
		line: {
			width: settings.point_size
		},
		x: x_coords,
		y: y_coords
	}];
	const plotly_layout = {
		datarevision: 0,
		hovermode: 'closest'
	};

	// Init progressbar colors for user feedback
	const progress = $('#progress-text>span');
	progress.removeClass('text-success text-danger').addClass('text-info');
	
	Plotly.purge('plot');


	// Visualize per chunk
	for(let chunk_index = 0,
		file_offset = chunk_index * chunk_size_mb;
		chunk_index < total_chunks;
		chunk_index++)
	{
		console.log(`Drawing Chunk ${1+chunk_index}/${total_chunks}`);

		// Wrap it in a Promise because FileReader is async
		const file_content_chunk = await new Promise((resolve, reject) => {
			file_reader.onloadend = (event) => {
				if (event.target.error === null) {
					file_offset += event.target.result.length;
					resolve(event.target.result);
				}
				else {
					reject(event.target.error);
				}
			};
			const blob = settings.input_file.slice(file_offset, (file_offset + chunk_size_mb));
			file_reader.readAsText(blob);
		}).catch(e => {
			alert("Error: Please check the console.");
			progress.addClass('text-danger');
			throw new Error(e);
		});

		const sequences_in_chunk = file_content_chunk.split('\n');

		// for each sequence in the current chunk
		for(let i = 0; i < sequences_in_chunk.length; i++) {
			if(sequences_in_chunk[i][0] === '>') {
				// Ignore the comment on this line
				console.warn(`Ignored comment line #${1 + i}: "${sequences_in_chunk[i]}"`);
				continue;
			}

			const bases = sequences_in_chunk[i].toLowerCase();

			for(let base_index = 0; base_index < bases.length; base_index++) {
				const current_base = bases[base_index] === 'a' 
				|| bases[base_index] === 't' 
				|| bases[base_index] === 'g' 
				|| bases[base_index] === 'c' 
				? bases[base_index] : 'x';
				
				moveCursor(settings[current_base].direction, cursor);
	
				if(current_point % settings.point_offset === 0) {
					x_coords.push(cursor.x);
					y_coords.push(cursor.y);

					if(settings.color_enabled) {
						colors[0].push(settings[current_base].color);
					}
				}

				current_point += 1;
			}
		}
		
		
		// Sequence got generated now, tell plotly about it
		plotly_data[0].x = x_coords;
		plotly_data[0].y = y_coords;
		// this is needed because otherwise the graph will NOT be redrawn by plotly
		plotly_layout.datarevision = chunk_index;

		// .react so that it efficiently replaces the old graph
		Plotly.react('plot', plotly_data, plotly_layout);


		// Now update the percentage to provide some feedback
		const percentage = ((file_offset / settings.input_file.size) * 100).toFixed(1) + '%';
		progress.text(percentage);
		document.getElementById('progress-bar').style.width = percentage;
	}

	if(settings.color_enabled) {
		Plotly.restyle('plot', 'marker.color', colors);
	}

	// End

	// indicate via the percentage color that you're successful
	progress.removeClass('text-info').addClass('text-success');

	// Show some edit options
	$('#quickedit-container').removeClass('d-none');
	const plot = document.getElementById('plot');
	document.getElementById('quickedit-size').value = settings.point_size;
	document.getElementById('quickedit-x-range-min').value = plot.layout.xaxis.range[0];
	document.getElementById('quickedit-x-range-max').value = plot.layout.xaxis.range[1];
	document.getElementById('quickedit-y-range-min').value = plot.layout.yaxis.range[0];
	document.getElementById('quickedit-y-range-max').value = plot.layout.yaxis.range[1];

	const end_date = new Date();
	console.log("Finished plotting at", end_date, '\n');
	
	console.log("== Total:", end_date.getTime() - start_date.getTime(), 'ms.');
}


/**
 * Performs action on the plot without needing to recalculate the underlying sequence.
 * Currently:
 * * Marker size
 * * X and Y ranges
 */
function applyQuickEdit() {
	const plot = document.getElementById('plot');
	
	const new_style = {
		'marker.size': document.getElementById('quickedit-size').value,
		'line.width': document.getElementById('quickedit-size').value
	};

	Plotly.restyle('plot', new_style).then(() => {
		document.getElementById('quickedit-size').value = plot.data[0].marker.size;
	});
	
	const new_layout = {
		'xaxis.range': [ document.getElementById('quickedit-x-range-min').value, document.getElementById('quickedit-x-range-max').value ],
		'yaxis.range': [ document.getElementById('quickedit-y-range-min').value, document.getElementById('quickedit-y-range-max').value ]
	};

	Plotly.relayout('plot', new_layout).then(() => {
		document.getElementById('quickedit-x-range-min').value = plot.layout.xaxis.range[0];
		document.getElementById('quickedit-x-range-max').value = plot.layout.xaxis.range[1];
		document.getElementById('quickedit-y-range-min').value = plot.layout.yaxis.range[0];
		document.getElementById('quickedit-y-range-max').value = plot.layout.yaxis.range[1];
	});
	
}



////////////////////////////////////////////////////////////////////////////////
///////////////// LISTENERS AND HELPERS ////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////


/**
 * Sets up main logic
 */
document.getElementById('btn-start').addEventListener('click', newPlot);


/**
 * Sets up quick edit logic
 */
document.getElementById('btn-quickedit').addEventListener('click', applyQuickEdit);


/**
 * Set in_file and corresponding tooltip
 */
$('#file').change(() => {
	const file = document.getElementById('file').files[0];
	if(file !== undefined) {
		$('#label-file>b').text(file.name.substr(0, 10) + '...');
		$('#label-file').attr('data-original-title', file.name).tooltip('show');
	} else {
		$('#label-file>b').text('Open File');
		$('#label-file').tooltip('dispose');
	}
});


/**
 * Activate Bootstrap tooltips
 */
$(function () {
	$('[data-toggle="tooltip"]').tooltip()
})


/**
 * Converts color hex strings to numbers  
 * 
 * @param {string} hex 
 * 
 * @returns {Array} array holding [R, G, B]
 */
function hexToRGB(hex) {
	let r = parseInt(hex.slice(1, 3), 16),
		g = parseInt(hex.slice(3, 5), 16),
		b = parseInt(hex.slice(5, 7), 16);

	return [r, g, b];
}