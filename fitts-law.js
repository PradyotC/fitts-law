"use strict";

/**
 * Create dimensions from the given values and store them for later use.
 * All values should be positive and make sense.
 * @param {number} width The outer width of the area.
 * @param {number} height The outer height of the area.
 * @param {number} top Margin form the top edge.
 * @param {number} right Margin form the right edge.
 * @param {number} bottom Margin form the bottom edge.
 * @param {number} left Margin form the left edge.
 */
function makeDimension(width, height, top, right, bottom, left) {
	return {width: width,
		height: height,
		innerWidth: width - (left + right),
		innerHeight: height - (top + bottom),
		top: top,
		right: right,
		bottom: bottom,
		left: left,
		cx: (width - (left + right)) / 2 + left,
		cy: (height - (top + bottom)) / 2 + top};
}

var screen_width = window.screen.width;
var screen_height = window.screen.height;

// set up dimensions for the plotting.
var testDimension = makeDimension(screen_width, screen_height, 30, 30, 30, 30);
var plotPositionDimension = makeDimension(220, 200, 30, 30, 30, 30);
var plotVelocitiesDimension = plotPositionDimension;
var plotHitsDimension = plotPositionDimension;
var plotScatterDimension = makeDimension(220, 200, 30, 30, 30, 50);
var scatterEffectiveDimension = makeDimension(540, 300, 30, 30, 30, 50);
var positionEffectiveDimension = makeDimension(540, 200, 30, 30, 30, 40);
var speedEffectiveDimension = positionEffectiveDimension;
var histDimension = makeDimension(540, 300, 30, 30, 30, 50);

var LIVE_STAY = 1000;
var MAX_TIME = 200000;
var UPDATE_DELAY = MAX_TIME;
var MAX_SPEED = 6; // pixel/ms

// 620, 400
//  minD 120, maxD: 300
// minW:10 , maxW: 100
// minD is 20% of the screen. maxD is 50% of the screen
// minW is 2% of the screen. maxW is 16% 


// Distance, Width
var minW = testDimension.width*.10 

var long_dim = Math.max(testDimension.width, testDimension.height);

var tests = [
	[long_dim*.25 ,long_dim*.08, ['click'] ],
	[long_dim*.25 ,long_dim*.02, ['click'] ],
	[long_dim*.4 ,long_dim*.08, ['click'] ],
	[long_dim*.4 ,long_dim*.02, ['click'] ]
]

var buttonContainer;

var currentTest = 0

function findTestKeys(tests, currentTest) {
	var currentAction = tests[currentTest][2];
	var currentKeys = ''
	for (var i = 0; i < currentAction.length; i++) {
		currentKeys += currentAction[i] + ' ';
	}

	return currentKeys;

};


function rHit(r, rTarget) {
	return ((plotHitsDimension.innerWidth / 2) / rTarget) * r;
};



function v(v) {
	var colour = 'rgb(' + clampInt(0, 255, (v / MAX_SPEED) * 255) + ', 0, 0)';
	return colour;
};

var scatterX = d3.scale.linear()
	.domain([0.5, 5.5])
	.range([0, plotScatterDimension.innerWidth]);

var scatterY = d3.scale.linear()
	.domain([MAX_TIME, 0])
	.range([0, plotScatterDimension.innerHeight]);

var scaleT = d3.scale.linear()
	.domain([0, 1000])
	.range([0, plotVelocitiesDimension.innerWidth]);

var scaleV = d3.scale.linear()
	.domain([0, MAX_SPEED])
	.range([plotVelocitiesDimension.innerHeight, 0]);

var scaleX = d3.scale.linear()
	.domain([-20, 300])
	.range([0, plotPositionDimension.innerWidth]);

var scaleY = d3.scale.linear()
	.domain([-50, 50])
	.range([plotPositionDimension.innerHeight, 0]);

var effScatterX = d3.scale.linear()
	.domain([0.5, 6.5])
	.range([0, scatterEffectiveDimension.innerWidth]);

var effScatterY = d3.scale.linear()
	.domain([MAX_TIME, 0])
	.range([0, scatterEffectiveDimension.innerHeight]);

var effPositionX = d3.scale.linear()
	.domain([-60, 400])
	.range([0, positionEffectiveDimension.innerWidth]);

var effPositionY = d3.scale.linear()
	.domain([-50, 50])
	.range([positionEffectiveDimension.innerHeight, 0]);
	
var effSpeedX = d3.scale.linear()
	.domain([0, MAX_TIME])
	.range([0, speedEffectiveDimension.innerWidth])

var effSpeedY = d3.scale.linear()
	.domain([0, MAX_SPEED])
	.range([speedEffectiveDimension.innerHeight, 0]);

var elem = document.documentElement;
var firstClick = false;
var endedTest = false;

var keyPressedDict = {}


function openFullscreen() {
	if (elem.requestFullscreen) {
		elem.requestFullscreen();
	} else if (elem.webkitRequestFullscreen) { /* Safari */
		elem.webkitRequestFullscreen();
	} else if (elem.msRequestFullscreen) { /* IE11 */
		elem.msRequestFullscreen();
	}
	}
	
	/* Close fullscreen */
	function closeFullscreen() {
	if (document.exitFullscreen) {
		document.exitFullscreen();
	} else if (document.webkitExitFullscreen) { /* Safari */
		document.webkitExitFullscreen();
	} else if (document.msExitFullscreen) { /* IE11 */
		document.msExitFullscreen();
	}
	}


var fittsTest = {
	target: {x: 0, y: 0, r: 10},
	text: {x: 0, y: 0, text: 'red'},
	start: {x: 0, y: 0, t: 0},
	last: {},

	isoPositions: [],
	currentPosition: 0,
	currentCount: 0,
	miss: 0,
	isoLimits: {minD: 120, maxD: 300, minW:10 , maxW: 100},
	isoParams: {num: 9, distance: 200, width: 50, randomize: true},
	
	currentPath: [],
	active: false,
	
	data: [],
	currentDataSet: 0,
	dataCnt: 0,
	
	colour: d3.scale.category10(),
	
	sumID: 0,
	sumTime: 0,
	
	updateTimeoutHandle: undefined,
	
	mousePosition: [0,0],

	generateTarget: function() {
		this.target = this.isoPositions[this.currentPosition];
		this.target.distance = this.isoParams.distance;
		this.currentPosition = (this.currentPosition + Math.ceil(this.isoPositions.length/2)) % this.isoPositions.length;
		
		var target = testAreaSVG.selectAll('#target').data([this.target]);

		var insert = function(d) {
			d.attr('cx', function(d) { return d.x; })
			.attr('cy', function(d) { return d.y; })
			.attr('r', function(d) { return d.w / 2; });
			
			// d.attr('text-anchor', 'middle')
			// .attr('alignment-baseline', 'middle')
			// .text('red');
		}

		target.enter()
			.append('circle')
				.attr('id', 'target')
				.style('fill', 'red')
				.call(insert);
									
		target.transition()
				.call(insert);
		
		this.active = true;

		if(firstClick == false){
			this.testInstructionMsg();
		}
	},
	
	updateISOCircles: function() {
		this.currentCount = 0;
		
		this.generateISOPositions(this.isoParams.num,
			this.isoParams.distance,
			this.isoParams.width);

		var circles = testAreaSVG.selectAll('circle').data(this.isoPositions);
		
		var insert = function(d) {
			d.attr('cx', function(d) { return d.x; })
			.attr('cy', function(d) { return d.y; })
			.attr('r', function(d) { return d.w / 2; });
		}

		circles.enter()
			.append('circle')
				.attr('class', 'iso')
				.call(insert);
									
		circles.transition()
			.call(insert);
		
		circles.exit()
			.transition()
				.attr('r', 0)
				.remove();
				
		this.currentPosition = 0;
		this.generateTarget();
		this.active = false;
},
	
	generateISOPositions: function(num, d, w) {
		
		// remove all data from live view
		plotHitsGroup.selectAll('circle.hit')
			.transition()
				.duration(LIVE_STAY)
					.ease('linear')
					.attr('r', 2)
					.style('opacity', 0)
					.remove();
		
		plotPositionGroup.selectAll('line.live')
			.transition()
				.duration(LIVE_STAY)
				.style('stroke-opacity', 0)
				.remove();

		plotVelocitiesGroup.selectAll('line.live')
			.transition()
				.duration(LIVE_STAY)
				.style('stroke-opacity', 0)
				.remove();
		
		
		this.isoPositions = [];
		
		for (var i = 0; i < num; i++) {
			this.isoPositions[i] = {x: testDimension.cx + ((d/2) * Math.cos((2 * Math.PI * i) / num)),
				y: testDimension.cy + ((d/2) * Math.sin((2 * Math.PI * i) / num)),
				w: w};
		}
	},
	
	removeTarget: function() {

		testAreaSVG.selectAll('#target').data([])
			.exit()
				.remove();
				
		this.active = false;
		this.currentPath = [];
	},

	keyPressed: function(key_press_dict) {

		// just check if this is the right key for the test


		// check if key_press_dict contains any of the required keys
		//  multiple keys can be required for a test,
		// so keys_pressed is a list bools. required_keys is a list of keys

		// console.log(keys_pressed)
		// if the list is all true, then call mouseClicked

		this.mouseClicked(this.mousePosition[0], this.mousePosition[1], key_press_dict);

	},
	
	mouseClicked: function(x, y, key_press_dict) {

		// if this is the first click, go to fullscreen
		if (firstClick == false) {
			firstClick = true;
			// this.nextTest();
			openFullscreen();
			this.pressButtonPopup(findTestKeys(tests, currentTest));
			this.closeTestInstructionMsg();
			this.testBtns();
		}

		// console.log("mouseClicked" + key_press_dict[0])
		if (currentTest == tests.length) {
			// if current test is the last one, close fullscreen
			closeFullscreen();
			// delete all buttons. draw "thank you" text and say to save
		}
		var test = tests[currentTest]
		// console.log(test)
		var required_keys = test[2];
		// console.log(required_keys)
		var keys_pressed = required_keys.map(function(d) { return key_press_dict[d]; });
		// console.log(keys_pressed)
		if (!keys_pressed.every(function(d) { return d == true; })) {
			return
		}
		
		if (distance({x: x, y: y}, this.target) < (this.target.w / 2) && !endedTest) {
			this.addDataPoint({start: this.start,
							   target: this.target,
							   path: this.currentPath,
							   hit: {x: x, y: y, t: (new Date).getTime()},
							   key_press: tests[currentTest][2].toString()});
			this.removeTarget();

			if (this.isoParams.randomize && this.currentCount >= this.isoPositions.length) {
				this.nextTest();
				if (currentTest < tests.length) {
					// if current test is the last one, return
					
					this.currentCount = 0;
					this.currentPosition = 0;
					this.miss = 0;
					this.updateISOCircles;
					this.generateTarget();
					this.active = false;
				}
			}
			else {
				this.currentCount++;
				this.generateTarget();			
			}

			
			this.last = {x: x, y: y, t: (new Date).getTime()};
			this.start = this.last;
			this.currentPath.push(this.last);
		}
		else {
			this.miss++;
		}
	},
	
	mouseMoved: function(x, y) {
		this.mousePosition = [x,y]

		if (this.active) {
			// skip if the mouse did actually not move
			// that should practically never happen...
			if (x == this.last.x && y == this.last.y) {
				return;
			}
			
			// set timeout for updating plots
			if (this.updateTimeoutHandle) {
				window.clearTimeout(this.updateTimeoutHandle);
			}

			// this.updateTimeoutHandle = window.setTimeout(this.updatePlots, UPDATE_DELAY, this);
			
			
			var newPoint = {x: x, y: y, t: (new Date).getTime()}
			this.currentPath.push(newPoint)
			
			var dt = newPoint.t - this.last.t;
			var dist = distance(this.last, {x: x, y: y})
			if (dt > 0)
				var speed = dist / dt;
			else
				var speed = 0;
			
			testAreaSVG.append('line')
				// .attr('class', '')
				.attr('x1', this.last.x)
				.attr('x2', newPoint.x)
				.attr('y1', this.last.y)
				.attr('y2', newPoint.y)
				.style('stroke', v(speed))
				.transition()
					.duration(5000)
					.style('stroke-opacity', 0)
					.remove();
				
			this.last = newPoint;
		}
	},
	
	addDataPoint: function(data) {
		// add point to data array for plotting into ID/time scatter plot
		if (this.active == false)
			return;

		var dt = data.hit.t - data.start.t;
	
		if (dt < MAX_TIME)  // skip if obvious outlier
		{
			var dist = distance(data.target, data.start);
			var id = shannon(dist, data.target.w);

			this.data[this.currentDataSet].data.push({time: dt, distance: data.target.distance, width: data.target.w, hit: data.hit,
				start: data.start, target: data.target, path: data.path, key_press: data.key_press});

			scatterGroup.append('circle')
				.attr('class', 'cat' + this.currentDataSet)
				.style('fill', this.data[this.currentDataSet].colour)
				.attr('cx', scatterX(id))
				.attr('cy', scatterY(dt))
				.attr('r', 0)
					.transition()
						.duration(200)
						.ease('bounce')
						.attr('r', 3);		
		
			var A = data.start;
			var B = data.target;
			var path = data.path;
		
			var hit = {}
			var q = project(A, B, data.hit);
			hit.x = distance(q, B) * sign(q.t - 1);
			hit.y = distance(q, data.hit) * isLeft(A, B, data.hit);
		
		
			plotHitsGroup.append('circle')
				.attr('class', 'hit')
				.attr('cx', rHit(hit.x, data.target.w / 2))
				.attr('cy', rHit(hit.y, data.target.w / 2))
				.attr('r', 6)
				.style('fill', 'red')
				.style('opacity', 1)
				.transition()
					.duration(500)
						.ease('linear')
						.attr('r', 3);
		
			var last = { x: 0, y: 0, t: data.start.t, v: 0};
			for (var i = 0; i < path.length; i++) {
				var p = path[i];
			
				var q = project(A, B, p);
				var x = distance(q, A) * sign(q.t);
				var y = distance(q, p) * isLeft(A, B, p);

				var dt = p.t - last.t;
				var dist = distance(last, {x: x, y: y});
				if (dt > 0)
					var speed = dist / dt;
				else
					var speed = 0;
		
				plotPositionGroup.append('svg:line')
					.attr('class', 'live')
					.attr('x1', scaleX(last.x))
					.attr('x2', scaleX(x))
					.attr('y1', scaleY(last.y))
					.attr('y2', scaleY(y))
					.style('stroke', v(speed))
					.transition()
						.duration(LIVE_STAY)
						.style('stroke-opacity', 0.5);
			
				plotVelocitiesGroup.append('svg:line')
					.attr('class', 'live')
					.attr('x1', scaleT(last.t - data.start.t))
					.attr('x2', scaleT(p.t - data.start.t))
					.attr('y1', scaleV(last.v))
					.attr('y2', scaleV(speed))

					.style('stroke', v(speed))
					.transition()
						.duration(LIVE_STAY)
						.style('stroke-opacity', 0.5);
					
				var last = {}
				last.x = x;
				last.y = y;
				last.t = p.t;
				last.v = speed;
			}
		}
	},

	nextTest: function() {
		// this.isoParams.distance = Math.floor(randomAB(this.isoLimits.minD, this.isoLimits.maxD));
		// this.isoParams.width = Math.floor(randomAB(this.isoLimits.minW, this.isoLimits.maxW));
		if (currentTest == tests.length) {
			// if current test is the last one, close fullscreen
			closeFullscreen();
			// and show the results
		}

		this.isoParams.distance = tests[currentTest][0]
		this.isoParams.width = tests[currentTest][1]
		currentTest = currentTest + 1

		if (currentTest == tests.length) {
			console.log('finished all tests and exiting');
			this.finishedTestPopup();
	
			this.removeTarget();

			// not working as expected
			var circles = testAreaSVG.selectAll('circle').data(this.isoPositions);
			circles.exit()
			.transition()
				.attr('r', 0)
				.remove();
			
			closeFullscreen();
			return;
		}

		this.closePressButtonPopup();
		this.pressButtonPopup(findTestKeys(tests, currentTest));

		$('#sliderDistance').slider('value', this.isoParams.distance);
		$('#sliderWidth').slider('value', this.isoParams.width);

		this.updateISOCircles();
		d3.select('#sliderDistanceValue').text(this.isoParams.distance);
		d3.select('#sliderWidthValue').text(this.isoParams.width);
	},
	// not used anymore. just here for reference.
	randomizeParams: function() {
		this.isoParams.distance = Math.floor(randomAB(this.isoLimits.minD, this.isoLimits.maxD));
		this.isoParams.width = Math.floor(randomAB(this.isoLimits.minW, this.isoLimits.maxW));

		$('#sliderDistance').slider('value', this.isoParams.distance);
		$('#sliderWidth').slider('value', this.isoParams.width);

		this.updateISOCircles();
		d3.select('#sliderDistanceValue').text(this.isoParams.distance);
		d3.select('#sliderWidthValue').text(this.isoParams.width);
	},
	
	addDataSet: function() {
		
		// first update the plots
		// this.updatePlots(this);
		
		this.dataCnt++;
		var num = this.dataCnt;
		var colour = this.colour(randomAB(0, 10));
		
		this.data[num] = {data: [], colour: colour};
		
		this.currentDataSet = num
		var div = d3.select('#dataSets').append('div')
			.attr('id', 'dataSet' + num)
			.text('Data Set ' + num + ' ')
			.style('background-color', colour);
		
		var buttonID ='removeDataSet' + num;
		div.append('button')
			.attr('id', buttonID)
			.attr('type', 'button')
			.text('delete!');
			
		var that = this;
		
		$('#' + buttonID).click(function() {
			that.deleteDataSet(num);
			fittsTest.active = false;
		});
		
		$('#dataSet' + num).click(function() {
			if (assIsKey(num, that.data)) {
				that.currentDataSet = num;
				that.highlightDataSet(num);				
			}
			fittsTest.active = false;

		})
			
		this.highlightDataSet(num);
		// add colour
		
	},
	
	deleteDataSet: function(num) {
		if (assSize(this.data) == 1)
		{
			alert('Cannot delete data set! Create another data set first.')
		} else
		{	
			d3.select('#dataSet' + num).remove();
			delete this.data[num];
			
			scatterGroup.selectAll('.cat' + num)
				.transition()
					.duration(500)
						.attr('r', 0)
						.remove();
			
			scatterEffectiveGroup.selectAll('.cat' + num)
				.transition()
					.duration(500)
						.style('opacity', 0)
						.remove();
			
			throughputGroup.selectAll('rect.cat' + num)
				.transition()
					.duration(500)
						.attr('width', 0)
						.remove();
						
			positionEffectiveGroup.selectAll('line.cat' + num)
				.transition()
					.duration(500)
						.style('opacity', 0)
						.remove()
			
			speedEffectiveGroup.selectAll('line.cat' + num)
				.transition()
					.duration(500)
						.style('opacity', 0)
						.remove()
			
			if (num == this.currentDataSet) {
				var first = parseInt(assFirstKey(this.data));
				this.currentDataSet = first;
				this.highlightDataSet(first);
			}
			
			// this.updatePlots(this);
		}
	},

	clickEndTestBtn: function() {
		// console.log('clicked end test button');
		closeFullscreen();
		this.finishedTestPopup;
	},

	testBtns: function() {
		this.buttonData = {label: "EXIT FULLSCREEN", x: screen_height/16, y: screen_height/16, function: function(){}};
		this.buttonData2 = {label: "END TEST", x: 200+screen_height/16, y: screen_height/16, function: function(){}};
		var button = d3.button(); 
		var endTestButton = testAreaSVG.selectAll(".button").data([this.buttonData]);

		endTestButton.enter()
		.append("g")
		.attr("class", "button")
		.style("fill", "gray")
		.on('mousedown', closeFullscreen)
		.call(button);

		var exitFullscreenButton = testAreaSVG.selectAll(".button2").data([this.buttonData2]);
		exitFullscreenButton.enter()
		.append("g")
		.attr("class", "button")
		.style("fill", "red")
		.on('mousedown', this.finishedTestPopup)
		.call(button);
	},

	closeTestBtns: function() {
		testAreaSVG.selectAll(".button").remove();

	},
	
	highlightDataSet: function(num) {
		d3.selectAll('#dataSets div')
			.attr('class', '');
		d3.select('#dataSet' + num)
			.attr('class', 'active')
	},

	testInstructionMsg: function() {
		d3.select('#test-area').append('div')
			.attr('class', 'testmsg')
			.text('Click anywhere on the screen to begin the test.\
			The test consists of moving the mouse to each of the red buttons, and then clicking on\
			the red button. The test completes when there are no more red buttons.\
			If you wish to exit the test early, press the \'end test\' button.')
			.style('opacity', 1);
	},

	closeTestInstructionMsg: function() {
		d3.select('body').selectAll('.testmsg').remove();

		d3.select('body').append('div')
		.attr('class', 'endTestMsg')
		.text('Note: You cannot end the test until one full round of 9 buttons is completed.')
		.style('opacity', 1);
	},

	pressButtonPopup: function(action) {
		d3.select('body').append('div')
			.attr('class', 'keyinstructions')
			// .text('Press the button with the following keys: ' + action)
			.text('Each time a red button shows up, please click on it')
			.style('opacity', 1);
	},

	closePressButtonPopup: function() {
		d3.select('body').selectAll('.keyinstructions').remove();
	},

	displayData: function() {
		// console.log("Displaying Data")
		fittsTest.addDataSet();
		fittsTest.active = false;
		let newData = [];
		for (var i = 1; i <= fittsTest.data.length - 2; i++) {
			newData[i - 1] = fittsTest.data[i];
		}
		var id = buttonContainer.select('#id').property('value')
		var device = buttonContainer.select('#device').property('value')
		var dataa = {"id": id, "device": device, "data": newData};
		console.log(JSON.stringify(dataa));
	}
	,


	finishedTestPopup: function() {
		// d3.select('body').append('div')
		// 	.attr('class', 'keyinstructions')
		// 	.text('Test finished! Scroll down to see the results and download the data.')
		// 	.style('opacity', 1)

		if(currentTest == 0) {
			console.log("No test has been run yet");
			return;
		}

		closeFullscreen();
		endedTest = true;
		fittsTest.removeTarget();

		const container = d3.select("body")
			.append("div")
			.attr("class", "grid_4 border sans saveMsg")
			.style("height", "75%")
			.style("padding", "0px")
			.style("width", "50%");

			// Add title
			container.append("h2")
			.text("Save Results");

			// add instructions
			container.append("p")
			.text("You will be provided a participant ID. Please enter it below.")

			container.append("p")
			.text("You will also be provided a device type. Please enter it below.")
			
			// Add form element
			const form = container.append("form");
			
			form.append("label")
			.attr("for", "id")
			.text("Participant ID:");
			form.append("br");
			form.append("input")
			.attr("type", "text")
			.attr("id", "id")
			.attr("name", "id");
			form.append("br");
			form.append("label")
			.attr("for", "device")
			.text("Device Type:");
			form.append("br");
			form.append("input")
			.attr("type", "text")
			.attr("id", "device")
			.attr("name", "device");
			
			// Add hr element
			container.append("hr");
			
			// Add data sets section
			const dataSetsSection = container.append("p");

			// make button have large text
			container.append("button")
			.attr("id", "dataButton")
			.attr("type", "button")
			.text("Record Data")
			.style("font-size", "20px")
			.on("click", fittsTest.displayData);

			buttonContainer = container;
	},


	
	updatePlots: function(that) {
		// a little I candy :D
		d3.select('body').append('div')
			.attr('class', 'msg')
			.text('updating plots...')
			.style('opacity', 1)
			.transition()
				.duration(2000)
					.style('opacity', 0)
					.remove();
					
		/* we haven't moven inside the test area, so we can as well disable
		 * the test for now
		 */
		that.active = false;

		// for each data set
		// compute We and IDe and Throughput for each category

		// process data
		var dataSetIndex = -1; // evil hack to make it start at 0 then.
		for (var key in that.data) { // for each data set
			
			dataSetIndex++;
			
			var groups = [];
			for (var i = 0; i < that.data[key].data.length; i++) { // for each datum
				var datum = that.data[key].data[i];
				var groupID = datum.distance.toString() + datum.width.toString();
				if (!groups[groupID]) {
					groups[groupID] = [];
				}
				
				var q = project(datum.start, datum.target, datum.hit);
				// var x = distance(q, datum.start) * sign(q.t);
				var y = distance(q, datum.hit) * isLeft(datum.start, datum.target, datum.hit);
				
				datum.realDistance = distance(datum.start, datum.hit); // use real distance here.
				datum.projectedHitOffsetX = distance(q, datum.target) * sign(q.t - 1);
				datum.projectedHitOffsetY = y;
				
				groups[groupID].push(datum);
			}

			var newData = [];
			for (var group in groups) {
				if (groups[group].length < 3) { // exlcude groups with length < 3
					continue;
				}
					
				var xEffective = 4.133 * Math.sqrt(variance(groups[group], function(d) { return d.projectedHitOffsetX; }))
				var yEffective = 4.133 * Math.sqrt(variance(groups[group], function(d) { return d.projectedHitOffsetY; }))
				var dEffective = mean(groups[group], function(d) { return d.realDistance; });
				
				for (var i = 0; i < groups[group].length; i++) {
					var datum = groups[group][i];
					var We = Math.min(xEffective, yEffective); // SMALLER-OF model (MacKenzie, Buxton 92)
					var De = dEffective;
					datum.IDe = shannon(De, We);
					datum.throughput = 1000 * (datum.IDe/datum.time);
					newData.push(datum);
				}
			}
			
			
			// insert stuff in SVG
			var colour = that.data[key].colour;
			
			var insert = function(d) {
				d.attr('cx', function(d) { return effScatterX(d.IDe); })
				.attr('cy', function(d) { return effScatterY(d.time); })
				.attr('r', 5);
			}
			
			var circles = scatterEffectiveGroup.selectAll('circle.cat' + key)
				.data(newData);
			
			circles.enter()
				.append('circle')
					.attr('class', 'cat' + key)
					.style('fill', colour)
					.style('opacity', 0.5)
					.call(insert);
			
			circles.transition()
				.duration(500)
					.call(insert);
					
					
			// ==================== regression ========================
			var covTIDe = cov(newData,
				function(d) { return d.time; },
				function(d) { return d.IDe});
			
			var varIDe = variance(newData, function(d) { return d.IDe; })
			
			if (varIDe > 0)
				var b = covTIDe / varIDe;
			else
				var b = 0;
			
			var mT = mean(newData, function(d) { return d.time; });
			var mIDe = mean(newData, function(d) { return d.IDe; });
			var a = mT - b * mIDe;
			
			if (!isNaN(a))
			{			
				var makeLine = function(d) {
					return d
						.attr('x1', 0)
						.attr('x2', scatterEffectiveDimension.innerWidth)
						.attr('y1', function(d) { return effScatterY(d.y1); })
						.attr('y2', function(d) { return effScatterY(d.y2); })
				}
			
				var regression = scatterEffectiveGroup.selectAll('line.cat' + key)
					.data([{y1:a + b * 0.5, y2: a + b * 6.5}]);
			
				regression.enter().append('line')
					.attr('class', 'cat' + key)
					.style('stroke', colour)
					.style('stroke-width', 2)
					.call(makeLine);
			
				regression.transition()
					.call(makeLine);
			}
				

			// ============== histogram ====================
			var histThroughput = d3.layout.histogram()
				.bins(20)
				.range([0,10])
				.value(function(d){return d.throughput;})
				
			var throughputHistogramData = histThroughput(newData)
			
	//		histYMax = d3.max(throughputHistogramData, function(d) { return d.y; });
						
			var histX = d3.scale.ordinal()
				.domain(throughputHistogramData.map(function(d) { return d.x; }))	
				.rangeRoundBands([0, histDimension.innerWidth]);
	
			var histY = d3.scale.linear()
				.domain([0, d3.max(throughputHistogramData, function(d) { return d.y; })])
				.range([histDimension.innerHeight, 0]);
				
			var throughputRect = throughputGroup.selectAll('rect.cat' + key)
				.data(throughputHistogramData);
				
			
			var numDataSets = assSize(that.data);
			var xOffset = (histX.rangeBand() / numDataSets) * dataSetIndex;
			
			var makeRect = function(d) {
				d.attr('x', function(offset) { return function(d) { return (histX(d.x) + offset); }; }(xOffset))
				.attr('y', function(scale) { return function(d) { return (scale(d.y)); }; }(histY))
				.attr('width', (histX.rangeBand() / numDataSets) - 1)
				.attr('height', function(scale) { return function(d) { return (scale(0) - scale(d.y)); }; }(histY));
			}
			
			var histXAxis = d3.svg.axis()
				.scale(histX)
				.ticks(2);

			var histYAxis = d3.svg.axis()
				.scale(histY)
				.ticks(5)
			throughputGroup.selectAll("g.axis").remove()	
			
			throughputGroup.append("g")
				.attr("class", "axis")
				.attr("transform", "translate(0," + histDimension.innerHeight + ")")
				.call(histXAxis.tickSize(6,3,6).orient("bottom"));	
	
			// throughputGroup.append("g")
				// .attr("class", "axis")
				// .call(histYAxis.tickSize(-histDimension.innerWidth).orient("left"));
			
			throughputRect.enter()
				.append('rect')
				.attr('class', 'cat' + key)
				.attr('rx', 2)
				.attr('ry', 2)
				.style('fill', colour)
				.call(makeRect)
				
			throughputRect.transition()
				.duration(500)
				.call(makeRect)
				
			// ==================== eff position and speed ===================
			// more or less copy-pasted from above
			for (var i = 0; i < newData.length; i++)
			{
				var last = { x: 0, y: 0, t: newData[i].start.t, v: 0};
				var A = newData[i].start;
				var B = newData[i].target
				var dAB = distance(A, B);
				var offset = newData[i].distance - dAB;
				offset = 0;
								
				for (var j = 0; j < newData[i].path.length; j++)
				{

					var p = newData[i].path[j];
			
					var q = project(A, B, p);
					var x = distance(q, A) * sign(q.t);
					var y = distance(q, p) * isLeft(A, B, p);

					var dt = p.t - last.t;
					var dist = distance(last, {x: x, y: y});
					if (dt > 0)
						var speed = dist / dt;
					else
						var speed = 0;
		
					positionEffectiveGroup.append('line')
						.attr('class', 'cat' + key)
						.attr('x1', effPositionX(last.x + offset))
						.attr('x2', effPositionX(x + offset))
						.attr('y1', effPositionY(last.y))
						.attr('y2', effPositionY(y))
						.style('stroke', colour)
						.style('opacity', 0.5);
			
					speedEffectiveGroup.append('line')
						.attr('class', 'cat' + key)
						.attr('x1', effSpeedX(last.t - A.t))
						.attr('x2', effSpeedX(p.t - A.t))
						.attr('y1', effSpeedY(last.v))
						.attr('y2', effSpeedY(speed))
						.style('stroke', colour)
						.style('opacity', 0.5);
					
					var last = {}
					last.x = x;
					last.y = y;
					last.t = p.t;
					last.v = speed;
				}
			}
		}		
	}
};

// _empirical_ covariance
function cov(data, extractorA, extractorB) {
	
	if (data.length <= 1) { // no covariance for 0 or 1 element.
		return 0;
	}

	var mA = mean(data, extractorA);
	var mB = mean(data, extractorB);
	
	var cov = 0;
	for (var i = 0; i < data.length; i++) {
		cov += (extractorA(data[i]) - mA) * (extractorB(data[i]) - mB);
	}
	
	return cov / (data.length - 1);
}

function variance(data, extractor) {
	return cov(data, extractor, extractor);
}

function mean(data, extractor) {
	var sum = 0;
	for (var i = 0; i < data.length; i++) {
		sum += extractor(data[i]);
	}
	return sum / data.length;
}

function randomAB(a, b) {
	return a + Math.random() * (b - a);
}

function assSize(assArr) {
	var size = 0;
	for (var _ in assArr) {
		size++;
	}
	return size;
}

function assFirstKey(assArr) {
	for (var key in assArr) {
		return key;
		break;
	}
}

function assIsKey(needle, assArr) {
	for (var key in assArr) {
		if (needle == key) {
			return true;
		}
	}
	return false;
}


/**
 * Project a point q onto the line p0-p1
 * Code taken from: http://www.alecjacobson.com/weblog/?p=1486
 */
function project(A, B, p) {
	var AB = minus(B, A);
	var AB_squared = dot(AB, AB);
	if (AB_squared == 0) {
		return A;
	}
	else {
		var Ap = minus(p, A);
		var t = dot(Ap, AB) / AB_squared;
		return {x: A.x + t * AB.x,
				y: A.y + t * AB.y,
				t: t};
	}
}



function mouseMoved()
{
	var m = d3.svg.mouse(this);
	fittsTest.mouseMoved(m[0], m[1])
}

function mouseClicked()
{
	var m = d3.svg.mouse(this);
	// console.log(m)
	fittsTest.mouseClicked(m[0], m[1], {'click':true});
}

function keyPressed()
{
	var keyCode = d3.event.code;

	keyPressedDict[keyCode] = true;
	// console.log(keyPressedDict)

	fittsTest.keyPressed(keyPressedDict)
}

function keyReleased(event)
{
	delete keyPressedDict[d3.event.code];
}

function dot(a, b) {
	return (a.x * b.x) + (a.y * b.y);
}

// coutesy of http://stackoverflow.com/questions/3461453/determine-which-side-of-a-line-a-point-lies
function isLeft(A, B, p){
     return ((B.x - A.x)*(p.y - A.y) - (B.y - A.y)*(p.x - A.x)) >= 0 ? 1: -1;
}

function minus(a, b) {
	return {x: a.x - b.x, y: a.y - b.y};
}

function distance(a, b) {
	var dx = a.x - b.x;
	var dy = a.y - b.y;
	return Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
}

function sign(a) {
	return a >=0 ? 1 : -1;
}

function rgb2Hex(r, g, b) {
	return '#' +
		clampInt(0, 255, r).toString(16) +
		clampInt(0, 255, g).toString(16) +
		clampInt(0, 255, b).toString(16);
}

function clampInt(lower, upper, x) {
	return Math.min(upper, Math.max(lower, Math.floor(x)));
}

function shannon(A, W) {
	return Math.log(A / W + 1) / Math.log(2);
}

function bgRect(d, dim) {
	return d.append('rect')
		.attr('cx', 0)
		.attr('cy', 0)
		.attr('width', dim.width)
		.attr('height', dim.height)
		.attr('class', 'back');
}


d3.select("body")
	.on("keydown", keyPressed)
	.on("keyup", keyReleased);

var testAreaSVG = d3.select('#test-area').append('svg')
	.attr('width', '100%')
	.attr('height', '100%')
	// .attr("viewBox", [0, 0, 100, 100])
	.style('pointer-events', 'all')
    .on('mousemove', mouseMoved)
	.on('mousedown', mouseClicked)
	.call(bgRect, testDimension);

var plotPositionSVG = d3.select('#plot-positions').append('svg')
	.attr('width', plotPositionDimension.width)
	.attr('height', plotPositionDimension.height)
	.call(bgRect, plotPositionDimension)

var plotPositionGroup = plotPositionSVG.append('g')
	.attr('transform', 'translate('+ plotPositionDimension.left + ', ' + plotPositionDimension.top + ')');

var positionXAxis = d3.svg.axis()
	.scale(scaleX)
	.ticks(7)
var positionYAxis = d3.svg.axis()
	.scale(scaleY)
	.ticks(6)
	
plotPositionGroup.append("g")
    .attr("class", "axis")
    .call(positionXAxis.tickSize(plotPositionDimension.innerHeight).orient("bottom"));
plotPositionGroup.append("g")
    .attr("class", "axis")
    .call(positionYAxis.tickSize(-plotPositionDimension.innerWidth).orient("left"));


	


var plotHitsSVG = d3.select('#plot-hits').append('svg')
	.attr('width', plotHitsDimension.width)
	.attr('height', plotHitsDimension.height)
	.call(bgRect, plotHitsDimension);


var plotHitsGroup = plotHitsSVG.append('g')
		.attr('transform', 'translate('+ plotHitsDimension.cx + ', ' + plotHitsDimension.cy + ')');
plotHitsGroup.append('circle')
	.attr('cx', 0)
	.attr('cy', 0)
	.attr('r', plotHitsDimension.innerWidth/2)
	.style('opacity', 0.1)
plotHitsGroup.append('line')
	.attr('x1', 0)
	.attr('y1', 0)
	.attr('x2', -plotHitsDimension.cx)
	.attr('y2', 0);
plotHitsGroup.append('line')
	.attr('x1', 0)
	.attr('y1', 0)
	.attr('x2', -10)
	.attr('y2', -10);
plotHitsGroup.append('line')
	.attr('x1', 0)
	.attr('y1', 0)
	.attr('x2', -10)
	.attr('y2', 10);

	
	
var plotVelocitiesSVG = d3.select('#plot-velocities').append('svg')
	.attr('width', plotVelocitiesDimension.width)
	.attr('height', plotVelocitiesDimension.height)
	.call(bgRect, plotVelocitiesDimension);

var plotVelocitiesGroup = plotVelocitiesSVG.append('g')
	.attr('transform', 'translate('+ plotVelocitiesDimension.left + ', ' + plotVelocitiesDimension.top + ')');

var speedXAxis = d3.svg.axis()
	.scale(scaleT)
	.ticks(7)
var speedYAxis = d3.svg.axis()
	.scale(scaleV)
	.ticks(6)

plotVelocitiesGroup.append("g")
    .attr("class", "axis")
    .call(speedXAxis.tickSize(plotVelocitiesDimension.innerHeight).orient("bottom"))
	// .append('text')
	// 	.text('time in ms')
	// 	.attr('x', 80)
	// 	.attr('y', plotVelocitiesDimension.innerHeight + 25)
	// 	.style('text-anchor', 'middle');
		
plotVelocitiesGroup.append("g")
    .attr("class", "axis")
    .call(speedYAxis.tickSize(-plotVelocitiesDimension.innerWidth).orient("left"))
		// .append('text')
		// 	.text('pixel/ms')
		// 	.attr('x', -20)
		// 	.attr('y', 80)
		// 	.attr('transform', 'rotate(-90, -20, 80)')
		// 	.style('text-anchor', 'middle');




var scatterSVG = d3.select('#plot-scatter').append('svg')
	.attr('width', plotScatterDimension.width)
	.attr('height', plotScatterDimension.height)
	.call(bgRect, plotScatterDimension);

var scatterGroup = scatterSVG.append('g')
	.attr('transform', 'translate('+ (plotScatterDimension.left) + ',' + plotScatterDimension.top + ' )');

// define Axes.
var xAxis = d3.svg.axis()
	.scale(scatterX)
	.ticks(7)
	.tickSize(6, 3, 0);
var yAxis = d3.svg.axis()
	.scale(scatterY)
	.ticks(6)
	.tickSize(6, 3, 6)
	
// print axes
scatterGroup.append("g")
    .attr("class", "axis")
    .call(xAxis.tickSize(plotScatterDimension.innerHeight).orient("bottom"))
		// .append('text')
		// 	.text('ID')
		// 	.attr('x', 80)
		// 	.attr('y', plotScatterDimension.innerHeight + 25)
		// 	.style('text-anchor', 'middle');
scatterGroup.append("g")
    .attr("class", "axis")
    .call(yAxis.tickSize(-plotScatterDimension.innerWidth).orient("left"))
		// .append('text')
		// 	.text('time in ms')
		// 	.attr('x', -20)
		// 	.attr('y', 65)
		// 	.attr('transform', 'rotate(-90, -20, 80)')
		// 	.style('text-anchor', 'middle');



var scatterEffectiveSVG = d3.select('#scatterEffective').append('svg')
	.attr('width', scatterEffectiveDimension.width)
	.attr('height', scatterEffectiveDimension.height)
	.call(bgRect, scatterEffectiveDimension);

var scatterEffectiveGroup = scatterEffectiveSVG.append('g')
	.attr('transform', 'translate('+ (scatterEffectiveDimension.left) + ',' + scatterEffectiveDimension.top + ' )');

// define Axes.
var effXAxis = d3.svg.axis()
	.scale(effScatterX)
	.ticks(10)
	.tickSize(6, 3, 0);

var effYAxis = d3.svg.axis()
	.scale(effScatterY)
	.ticks(10)
	.tickSize(6, 3, 6)


// print axes
scatterEffectiveGroup.append("g")
    .attr("class", "axis")
	// .attr("transform", "translate( 0, " + plotScatterDimension.height + ")")
    .call(effXAxis.tickSize(scatterEffectiveDimension.innerHeight).orient("bottom"));

scatterEffectiveGroup.append("g")
    .attr("class", "axis")
	// .attr("transform", "translate( 0, " + plotScatterDimension.height + ")")
    .call(effYAxis.tickSize(-scatterEffectiveDimension.innerWidth).orient("left"));

var throughputSVG = d3.select('#throughput').append('svg')
	.attr('width', histDimension.width)
	.attr('height', histDimension.height)
	.call(bgRect, histDimension);

var throughputGroup = throughputSVG.append('g')
	.attr('transform', 'translate('+ (histDimension.left) + ',' + histDimension.top + ' )')

//	.call(histYAxis.tickSize(histDimension.innerWidth).orient("left"));

	

var positionEffectiveSVG = d3.select('#positionEffective').append('svg')
	.attr('width', positionEffectiveDimension.width)
	.attr('height', positionEffectiveDimension.height)
	.call(bgRect, positionEffectiveDimension);

var positionTargetsGroup = positionEffectiveSVG.append('g')
		.attr('transform', 'translate('+ (positionEffectiveDimension.left) + ',' + positionEffectiveDimension.top + ' )');

var positionEffectiveGroup = positionEffectiveSVG.append('g')
	.attr('transform', 'translate('+ (positionEffectiveDimension.left) + ',' + positionEffectiveDimension.top + ' )');

var positionEffXAxis = d3.svg.axis()
	.scale(effPositionX)
	.ticks(10)
	.tickSize(-positionEffectiveDimension.innerHeight)

var positionEffYAxis = d3.svg.axis()
	.scale(effPositionY)
	.ticks(5)
	.tickSize(-positionEffectiveDimension.innerWidth)

positionEffectiveGroup.append('g')
	.attr('class', 'axis')
	.attr('transform', 'translate(0, ' + positionEffectiveDimension.innerHeight + ')')
	.call(positionEffXAxis.orient('bottom'));
	
positionEffectiveGroup.append('g')
	.attr('class', 'axis')
		.call(positionEffYAxis.orient('left'));	
	
	
	

var speedEffectiveSVG = d3.select('#speedEffective').append('svg')
	.attr('width', speedEffectiveDimension.width)
	.attr('height', speedEffectiveDimension.height)
	.call(bgRect, speedEffectiveDimension);

var speedEffectiveGroup = speedEffectiveSVG.append('g')
	.attr('transform', 'translate('+ (speedEffectiveDimension.left) + ',' + speedEffectiveDimension.top + ' )');

var speedEffXAxis = d3.svg.axis()
	.scale(effSpeedX)
	.ticks(10)
	.tickSize(-speedEffectiveDimension.innerHeight)

var speedEffYAxis = d3.svg.axis()
	.scale(effSpeedY)
	.ticks(5)
	.tickSize(-speedEffectiveDimension.innerWidth)

speedEffectiveGroup.append('g')
	.attr('class', 'axis')
	.attr('transform', 'translate(0, ' + speedEffectiveDimension.innerHeight + ')')
	.call(speedEffXAxis.orient('bottom'));

speedEffectiveGroup.append('g')
	.attr('class', 'axis')
	.call(speedEffYAxis.orient('left'));





// init code
// should probably go somewhere else though. 
fittsTest.active = false;
fittsTest.generateISOPositions(15, 150, 10);
fittsTest.updateISOCircles();
d3.select('#sliderDistanceValue').text(fittsTest.isoParams.distance);
d3.select('#sliderWidthValue').text(fittsTest.isoParams.width);
fittsTest.addDataSet();

// setup sliders
$("#sliderDistance").slider({
	min: fittsTest.isoLimits.minD,
	max: fittsTest.isoLimits.maxD,
	step: 1,
	value: fittsTest.isoParams.distance,
	slide: function(event, ui) {
		fittsTest.isoParams.distance = ui.value;
		fittsTest.updateISOCircles();
		d3.select('#sliderDistanceValue').text(ui.value);
		$('#randomizeCheckbox').attr('checked', false);
		fittsTest.isoParams.randomize = false;
	}
});

$("#sliderWidth").slider({
	min: fittsTest.isoLimits.minW,
	max: fittsTest.isoLimits.maxW,
	step: 1,
	value: fittsTest.isoParams.width,
	slide: function(event, ui) {
		fittsTest.isoParams.width = ui.value;
		fittsTest.updateISOCircles();
		d3.select('#sliderWidthValue').text(ui.value);
		$('#randomizeCheckbox').attr('checked', false);
		fittsTest.isoParams.randomize = false;
	}
});

$('#randomizeButton').click(function() {
	fittsTest.nextTest();
	$('#randomizeCheckbox').attr('checked', true);
	fittsTest.isoParams.randomize = true;
});

$('#randomizeCheckbox').change(function(event) {
	fittsTest.isoParams.randomize = $(this).attr('checked');
})
