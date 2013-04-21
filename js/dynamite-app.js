dynamite = namespace('dynamite');
settingsui = namespace('dynamite.settingsui');

dynamite.ListView = Base.extend({
	constructor: function(plotModel) {
		this.model = plotModel;
		this.container = null;
		this.settingsCallback = null;

		// setup model listeners
		this.model.addListener('selectionChanged', function(previous, current) {
			if (!this.container)
				return;

			if (previous.length > 0) {
				for (var i = 0; i < previous.length; i++) {
					this.container.find('.dynamite-plot[data-hash="' + previous[i] + '"]').removeClass('selected');
					this.container.find('.dynamite-plot[data-hash="' + previous[i] + '"] .plot-settings').slideUp(function(e){ jQuery(this).html(''); });
				}
			}

			if (current.length > 0) {
				for (var i = 0; i < current.length; i++) {
					this.container.find('.dynamite-plot[data-hash="' + current[i] + '"]').addClass('selected');

					var plot = this.model.findPlot(current[i]);
					var settings = this.settingsCallback ? this.settingsCallback[0].apply(plot, [plot, current[i], this.settingsCallback[1]]) : null;

					if (settings) {
						var settingsHTML = settings.getHTML();

						if (settingsHTML) {
							this.container.find('.dynamite-plot[data-hash="' + current[i] + '"] .plot-settings').html(settingsHTML).slideDown();
							settings.setupEvents();
						}
					}
				}
			}
		}.bind(this));

		this.model.addListener('delete', function(plot, hash) {
			if (!this.container)
				return;

			this.container.find('.dynamite-plot[data-hash="' + hash + '"]').fadeOut('slow', function(){ jQuery(this).remove() });
		}.bind(this));

		this.model.addListener('add', function(plot, hash) {
			if (!this.container)
				return;

			this.addItem(plot, hash);
		}.bind(this));
	},

	setContainer: function($container) {
		this.container = $container;

		// clear container
		this.container.html('');

		// bind jquery events
		this.container.on('change', 'input[type="checkbox"].enable-disable', this, function(e) {
			var hash = jQuery(this).parents('.dynamite-plot').attr('data-hash');
			var listView = e.data;
			var plot = listView.model.findPlot(hash);

			if (!plot) return;

			plot.enabled = !plot.enabled;
			listView.model.refresh();
		});

		this.container.on('click', 'a.plot-link', this, function(e) {
			e.preventDefault();
			
			var hash = jQuery(this).parents('.dynamite-plot').attr('data-hash');
			var listView = e.data;

			listView.model.selectPlot(hash, 'hash', true);
		});

		this.container.on('click', 'a.plot-delete', this, function(e){
			e.preventDefault();

			var hash = jQuery(this).parents('.dynamite-plot').attr('data-hash');
			var listView = e.data;
			var plot = listView.model.findPlot(hash);

			listView.model.remove(plot);
		});

		// update with current plots
		this.model.each(this.addItem.bind(this), false);
	},

	setSettingsUICallback: function(callback, data) {
		this.settingsCallback = [callback, data];
	},

	prettyPrint: function(plot, $prettyprint) {
		var useMathML = false;

		if (plot.constructor == dynamite.plots.OrbitPlot) {
			useMathML = true;
			$prettyprint.html('... `x_0 = (' + plot.initialPoint.x.toFixed(2) + ', ' + plot.initialPoint.y.toFixed(2) + ')`');
			// return '... `x_0 = (' + plot.initialPoint.x.toFixed(2) + ', ' + plot.initialPoint.y.toFixed(2) + ') `';			
		} else if (plot.constructor == dynamite.plots.FunctionPlot) {
			useMathML = true;
			$prettyprint.html( '`' + $prettyprint.html() + '`');			
		} else if (plot.constructor == dynamite.plots.SlopeField) {
			useMathML = true;

			var str = $prettyprint.html();
			str = str.replace('x\'', 'dx/dt');
			str = str.replace('y\'', 'dy/dt');

			$prettyprint.html('`' + str + '`');
		}

		if (useMathML) {
			var replacements = {'atan': 'tan^-1', 'asin': 'sin^-1', 'acos': 'cos^-1'};
			var str = $prettyprint.html();

			var keys = Object.keys(replacements);
			for (var i = 0; i < keys.length; i++)
				str = str.replace(keys[i], replacements[keys[i]]);

			$prettyprint.html(str);
			AMprocessNode($prettyprint.get(0));
		}
	},

	addItem: function(plot, i) {
		if (!this.container)
			return;

		var html = '';
		html += '<div class="dynamite-plot" data-hash="'  + i + '" style="display: none;">';
		html += '<div class="header">';
		html += '<input type="checkbox" class="enable-disable" ' + (plot.enabled ? 'checked="checked"' : '') + '/>';
		html += '<a href="#" class="plot-link"><span class="prettyprint">' + plot.toString() + '</span></a>';
		html += '</div>';

		html += '<div class="plot-settings">';
		html += '</div>';
		
		html += '</div>';
	
		this.container.append(html);

		this.prettyPrint(plot, this.container.find('.dynamite-plot[data-hash="' + i  + '"] .prettyprint'));
		this.container.find('.dynamite-plot[data-hash="' + i + '"]').fadeIn('slow');
	}
});

dynamite._instances = {};
dynamite.createApp = function(appName, canvas) {
	var App = Base.extend({
		constructor: function(appName, htmlCanvas) {
			this.base();

			this.name = appName;
			this.model = new dynamite.plots.PlotModel();
			this.canvas = new dynamite.canvas.Canvas(htmlCanvas, this.model);
			this.listView = new dynamite.ListView(this.model);
			this.listView.setSettingsUICallback(this.settingsUI.bind(this));

			this.canvas.canvas.addEventListener('mouseup', function(e) {
				if (e.button == 0 && !e.altKey && !this.canvas.dragging) {
					this.model.clearSelection();
					return;
				}

				if (e.button != 0 || this.canvas.dragging ) {
					return;
				}

				var realCoords = this.canvas.cursorCoords;
				var plotSelection = this.model.getPlotSelection();

				if (plotSelection.length > 0) {
					var selectedPlot = plotSelection[0];

					if (selectedPlot.constructor == dynamite.plots.SlopeField || selectedPlot.constructor == dynamite.plots.OrbitPlot) {
						this.model.add(new dynamite.plots.OrbitPlot(selectedPlot.system, realCoords));
					}
				}
			}.bind(this));

		},

		settingsUI: function(plot, i) {
			var settingsProfile = plot.getSettingsProfile();
			return new dynamite.settingsui.SettingsUI(plot, i);
		},

		useAsListView: function($container) {
			this.listView.setContainer($container);
		},

		newPlotDialog: function() {
			var html = '';

			html += '<div class="dynamite-new-plot-dialog" style="display: none;">';
			html += '<h3>New Plot</h3>';
			
			// Cartesian
			html += '<div class="plot-type">';
			html += '<div class="header"><label><input type="radio" name="plotType" value="function" /> Cartesian Function</label></div>';
			html += '<div class="details">';
			html += '<label><span class="mathml">y = f(x) =</span> <input type="text" value="" class="fx" />';
			html += '</div>';
			html += '</div>';

			// Planar System
			html += '<div class="plot-type">';
			html += '<div class="header"><label><input type="radio" name="plotType" value="odesystem" /> Planar ODE System</label></div>';
			html += '<div class="details">';

			html += '<label><span class="mathml">dx/dt =</span> <input type="text" value="" class="dx" />, ';
			html += '<label><span class="mathml">dy/dt =</span> <input type="text" value="" class="dy" /></label>';

			html += '</div>';
			html += '</div>';

			// Julia Set
			html += '<div class="plot-type">';
			html += '<div class="header"><label><input type="radio" name="plotType" value="juliaset" /> Julia Set</label></div>';
			html += '<div class="details">';

			html += '<label><span class="mathml">c = </span><input type="text" value="" class="c_re" size="5" /> ';
			html += '<span class="mathml">+</span> <input type="text" value="" class="c_im" size="5" /> <span class="mathml">i</span></label>';

			html += '</div>';
			html += '</div>';

			html += '<br />';
			html += '<input type="button" value="Cancel" class="cancel-button" />';
			html += '<input type="button" value="Add" class="add-button" disabled="disabled" />';
			html += '</div>';

			jQuery('body').append(html);
			jQuery('.dynamite-new-plot-dialog span.mathml').each(function(i,e){
				var $e = jQuery(e);

				$e.html('`' + $e.html() + '`');
				AMprocessNode($e.get(0));
			});


			// bind stuff
			var esc_pressed = function(e){
				if (e.keyCode == 27) {
					jQuery.unblockUI();
					// jQuery(document).unbind('keydown');
				}
			};

			jQuery(document).keydown(esc_pressed);
			jQuery(document).keydown(function(e){
				jQuery(document).unbind('keydown', esc_pressed);
			});

			jQuery('.dynamite-new-plot-dialog .cancel-button').click(function(){
				jQuery.unblockUI();				
			});

			var $add = jQuery('.dynamite-new-plot-dialog .add-button');
			var $plotTypeRadios = jQuery('.dynamite-new-plot-dialog .plot-type input[type="radio"]');

			$plotTypeRadios.change(function(e){
				$add.removeAttr('disabled');

				$plotTypeRadios.parents('.plot-type').find('.details').hide();
				jQuery(this).parents('.plot-type').find('.details').fadeIn().find('input:first').focus();
			});

			$add.click(function(){
				var plotType = $plotTypeRadios.filter(':checked').val();

				switch (plotType) {
					case 'function':
						var formula = jQuery('.dynamite-new-plot-dialog input.fx').val();
						
						try {
							var e = Parser.parse(formula).simplify();
							var vars = e.variables();

							if (vars.length > 1 || (vars.length == 1 && vars.indexOf('x') == -1) )
								throw 'Invalid variables in formula';
						} catch(error) {
							alert('Parsing Error: ' + error.toString());
							return;
						}

						e.formula = formula;

						var plot = new dynamite.plots.FunctionPlot(e);
						this.model.add(plot);

						break;
					case 'odesystem':
						var formula_dx = jQuery('.dynamite-new-plot-dialog input.dx').val();
						var formula_dy = jQuery('.dynamite-new-plot-dialog input.dy').val();

						try {
							/* dx/dt */
							var edx = Parser.parse(formula_dx).simplify();
							var edxVars = edx.variables();
							var validVars = 0;
							
							if (edxVars.indexOf('x') > -1) validVars++;
							if (edxVars.indexOf('y') > -1) validVars++;
							if (edxVars.indexOf('t') > -1) validVars++;

							if (edxVars.length > 3 || (edxVars.length > validVars))
								throw 'Invalid variables in formula'; 


							/* dy/dt */
							var edy = Parser.parse(formula_dy).simplify();
							var edyVars = edy.variables();

							validVars = 0;
							if (edxVars.indexOf('x') > -1) validVars++;
							if (edxVars.indexOf('y') > -1) validVars++;
							if (edxVars.indexOf('t') > -1) validVars++;

							if (edxVars.length > 3 || (edxVars.length > validVars))
								throw 'Invalid variables in formula'; 							

							/* ODE System */
							edx.formula = formula_dx;
							edy.formula = formula_dy;

							var system2d = new dynamite.core.ODEParsedSystem(edx, edy);
							this.model.add(new dynamite.plots.SlopeField(system2d));
						} catch (err) {
							alert('Parsing Error: ' + err.toString());
							return;
						}

						break;
					case 'juliaset':
						var c_re = parseFloat(jQuery('.dynamite-new-plot-dialog input.c_re').val());
						var c_im = parseFloat(jQuery('.dynamite-new-plot-dialog input.c_im').val());

						if ( isNaN(c_re) || isNaN(c_im) ) {
							alert('Invalid number!');
							return;
						}

						this.model.add(new dynamite.plots.JuliaSetPlot(new dynamite.core.Point(c_re, c_im)));

						break;
					default:
						break;
				}

				jQuery.unblockUI();
			}.bind(this));


			jQuery.blockUI({
				message: jQuery('.dynamite-new-plot-dialog'),
				css: {
					textAlign: 'left',
					padding: '15px',
					width: '500px'
				},
				onUnblock: function() {
					jQuery('.dynamite-new-plot-dialog').remove();						
				}				
			});

		}

	});

	app = new App(appName, canvas);
	dynamite._instances[app.name] = app;

	return app;
};


/* Settings UI */
settingsui.SettingsUI = Base.extend({
	constructor: function(plot, hash) {
		this._id = 0;
		this.plot = plot;
		this.hash_ = hash;

		this._fields = {};
	},

	/* General purpose utilities */
	section: function(title, content) {
		return '<div class="section"><div class="title">' + title + '</div><div class="content">' + content + '</div></div>';
	},

	uniqid: function() {
		var uniq = (new Date()).getTime() + (this._id++);
		return 'dynamite-settingsfield-' + uniq;
	},

	lineSettings: function() {
		var html = '';

		// color selector
		var id = this.uniqid();
		this._fields['color-selector'] = { 'id': id, 'html': '<div class="setting lineColor"><label>Color:</label> <input type="text" class="color-selector" id="' + id + '" value="' + this.plot.get('lineColor') + '" /></div>' };
		html += this._fields['color-selector'].html;

		// line width slider
		id = this.uniqid();
		this._fields['line-width-slider'] = { 'id': id, 'html': '<div class="setting lineWidth"><label>Width:</label> <div class="line-width-slider noUiSlider" id="' + id + '"></div></div>' };
		html += this._fields['line-width-slider'].html;

		return this.section('Line', html);
	},

	axesSettings: function() {
		var html = '';

		var id = this.uniqid();

		this._fields['grid-checkbox'] = { 'id': id,
										  html: '<div class="setting"><input type="checkbox" id="' + id + '" ' + ( this.plot.get('showGrid') ? 'checked="checked"' : '' ) + ' /> <label>Grid</label></div>',
										  init: function(field, plot) {
										  	jQuery('#' + field.id).change(function(){
										  		plot.set('showGrid', jQuery(this).is(':checked'));
										  	})
										  }
										};
		html += this._fields['grid-checkbox'].html;

		id = this.uniqid();
		this._fields['axes-checkbox'] = { 'id': id,
										  html: '<div class="setting"><input type="checkbox" id="' + id + '" ' + ( this.plot.get('showLines') ? 'checked="checked"' : '' ) + ' /> <label>Axes</label></div>',
										  init: function(field, plot) {
										  	jQuery('#' + field.id).change(function(){
										  		plot.set('showLines', jQuery(this).is(':checked'));
										  	})
										  }
										};
		html += this._fields['axes-checkbox'].html;

		id = this.uniqid();
		this._fields['axes-ticks'] = { 'id': id,
										  html: '<div class="setting"><input type="checkbox" id="' + id + '" ' + ( this.plot.get('drawTicks') ? 'checked="checked"' : '' ) + ' /> <label>Ticks</label></div>',
										  init: function(field, plot) {
										  	jQuery('#' + field.id).change(function(){
										  		plot.set('drawTicks', jQuery(this).is(':checked'));
										  	})
										  }
										};
		html += this._fields['axes-ticks'].html;

		id = this.uniqid();
		this._fields['axes-labels'] = { 'id': id,
										  html: '<div class="setting"><input type="checkbox" id="' + id + '" ' + ( this.plot.get('showLabels') ? 'checked="checked"' : '' ) + ' /> <label>Labels</label></div>',
										  init: function(field, plot) {
										  	jQuery('#' + field.id).change(function(){
										  		plot.set('showLabels', jQuery(this).is(':checked'));
										  	})
										  }
										};
		html += this._fields['axes-labels'].html;

		return this.section('Axes', html);
	},

	slopeFieldSettings: function() {
		var html = '';
		var id = this.uniqid();

		this._fields['slope-field-density'] = { 'id': id,
										  html: '<div class="setting"><label>Density</label><div class="noUiSlider" id="' + id + '"></div></div>',
										  init: function(field, plot) {
										  	jQuery('#' + field.id).noUiSlider({
										  		range: [5.0,30.0],
										  		step: 1.0,
										  		handles: 1,
										  		start: plot.get('density'),
										  		slide: function() {
										  			var value = $(this).val();
										  			plot.set('density', value);
										  		}
										  	});
										  }
										};
		html += this._fields['slope-field-density'].html;

		id = this.uniqid();
		this._fields['slope-arrows-checkbox'] = { 'id': id,
										  html: '<div class="setting"><input type="checkbox" id="' + id + '" ' + ( this.plot.get('useArrows') ? 'checked="checked"' : '' ) + ' /> <label>Arrows</label></div>',
										  init: function(field, plot) {
										  	jQuery('#' + field.id).change(function(){
										  		plot.set('useArrows', jQuery(this).is(':checked'));
										  	})
										  }
										};
		html += this._fields['slope-arrows-checkbox'].html;		

		return this.section('Vector Field', html);
	},

	orbitPlotSettings: function() {
		var html = '';
		
		var id = this.uniqid();
		this._fields['orbit-integrator'] = { id: id,
											 html: '<div class="setting"><label>Integrator:</label> <select id="' + id + '"><option name="RungeKutta4">RungeKutta 4th Order</option></select></div>',
											 init: function(field, plot) {
											 }
										   };
		html += this._fields['orbit-integrator'].html;

		id = this.uniqid();
		this._fields['orbit-show-initial-point-checkbox'] = { 'id': id,
										  html: '<div class="setting"><input type="checkbox" id="' + id + '" ' + ( this.plot.get('showInitialPoint') ? 'checked="checked"' : '' ) + ' /> <label>Show initial point</label></div>',
										  init: function(field, plot) {
										  	jQuery('#' + field.id).change(function(){
										  		plot.set('showInitialPoint', jQuery(this).is(':checked'));
										  	})
										  }
										};
		html += this._fields['orbit-show-initial-point-checkbox'].html;		

		id = this.uniqid();
		this._fields['orbit-integrator-stepsize'] = { id: id,
											 		  html: '<div class="setting"><label>Step Size:</label> <input type="text" id="' + id + '" value="' + this.plot.get('solverStepSize') + '" size="5" /> <input type="button" value="OK" /></div>',
											 		  init: function(field, plot) {
											 		  	jQuery('#' + field.id).blur(function(){
											 		  		var value = parseFloat($(this).val());

											 		  		if (!value || value <= 0)
											 		  			value = 0.01;

											 		  		plot.set('solverStepSize', value);

											 		  		$(this).val(value);
											 		  	});
											 		  }
										   };
		html += this._fields['orbit-integrator-stepsize'].html;

		id = this.uniqid();
		this._fields['orbit-integrator-interval'] = { id: id,
											 		  html: '<div class="setting"><label>Time Interval:</label> 0...<input type="text" id="' + id + '" value="' + this.plot.get('solverTF') + '" size="5" /> <input type="button" value="OK" /></div>',
											 		  init: function(field, plot) {
											 		  	jQuery('#' + field.id).blur(function(){
											 		  		var value = parseFloat($(this).val());

											 		  		if (!value || value <= 0)
											 		  			value = 0.0;

											 		  		plot.set('solverTF', value);

											 		  		$(this).val(value);
											 		  	});
											 		  }
										   };
		html += this._fields['orbit-integrator-interval'].html;		

		return this.section('Differential Equation', html);
	},

	editSettings: function() {
		var html = '';

		html += '<div class="plot-actions">';
		html += '<a href="#" class="plot-delete">[Delete]</a>';
		html += '</div>';

		return html;
	},

	getHTML: function() {
		var html = '';

		if (this.plot.getSettingsProfile() != 'Axes')
			html += this.editSettings();

		html += this.lineSettings();

		switch (this.plot.getSettingsProfile()) {
			case 'Axes':
				html += this.axesSettings();
				break;
			case 'SlopeField':
				html += this.slopeFieldSettings();
				break;
			case 'OrbitPlot':
				html += this.orbitPlotSettings();
				break;
			default:
				break;
		}

		return html;
	},

	setupEvents: function() {
		var plot = this.plot;

		if ('color-selector' in this._fields)
			jQuery('#' + this._fields['color-selector'].id).simpleColor({
				boxWidth: '20px',
				boxHeight: '20px',
				onSelect: function(hex) {
					plot.set('lineColor', '#' + hex);
				}
			});

		if ('line-width-slider' in this._fields)
			jQuery('#' + this._fields['line-width-slider'].id).noUiSlider({
				range: [1.0,5.0],
				start: this.plot.get('lineWidth'),
				step: 0.5,
				handles: 1,
				slide: function() {
					var value = $(this).val();
					plot.set('lineWidth', value);
				}
			});

			var fields = Object.keys(this._fields);

			for (var i = 0; i < fields.length; i++) {
				var field = this._fields[fields[i]];

				if (typeof(field.init) != 'undefined') {
					field.init(field, this.plot);
				}
			}

	}
});

/* Initialization */
(function($){
	$(document).ready(function(){
		var app = dynamite.createApp('dynamite-instance', $('#dynamite-canvas').get(0));
		app.useAsListView($('#dynamite-plot-list'));

		// var e = Parser.parse('x^2 + 1');
		// e.formula = 'x^2 + 1';
		// app.model.add(new dynamite.plots.FunctionPlot(e));

		// Add
		$('#dynamite-toolbar a.add-plot').click(function(e) {
			e.preventDefault();
			app.newPlotDialog();
		});

		$(document).keydown(function(e){
			if ( e.metaKey && e.keyCode == 78) {
				e.preventDefault();
				app.newPlotDialog();
			}
		});

		$('#dynamite-toolbar a.examples').click(function(e) {
			e.preventDefault();

			var example = $(this).attr('data-example');

			app.model.each(function(plot) {
				if (plot.constructor == dynamite.plots.CoordinateAxes)
					return;

				this.model.remove(plot);
			}.bind(app));	

			app.canvas.resetViewLimits();		

			switch (example) {
				case 'harmonic-oscillator':
					var dx = Parser.parse('y');
					dx.formula = 'y';
					var dy = Parser.parse('-x');
					dy.formula = '-x';

					var oscillator = new dynamite.core.ODEParsedSystem(dx, dy);
					var slopeField = new dynamite.plots.SlopeField(oscillator);
					slopeField.settings.lineWidth = 1.0;
					slopeField.settings.useArrows = true;
					slopeField.settings.density = 15;
					slopeField.enabled = false;

					app.model.add(slopeField);

					for (var h = 0.0; h <= 2.5; h += 0.5) {
						var plot = new dynamite.plots.OrbitPlot(oscillator, new dynamite.core.Point(h, 0.0));
						plot.settings.lineWidth = 2.0;
						plot.settings.solverTF = 7.0;

						if (h == 0.0)
							plot.settings.showInitialPoint = true;

						app.model.add(plot);
					}

					break;
				case 'pendulum':
					var dx = Parser.parse('y');
					dx.formula = 'y';
					var dy = Parser.parse('-sin(x)');
					dy.formula = '-sin(x)';

					app.canvas.setViewLimits(-4.0, 8.0, -4.0, 4.0)

					var pendulum = new dynamite.core.ODEParsedSystem(dx, dy);
					var slopeField = new dynamite.plots.SlopeField(pendulum);
					slopeField.settings.lineWidth = 1.0;
					slopeField.settings.useArrows = true;
					slopeField.settings.density = 18;
					slopeField.enabled = false;

					app.model.add(slopeField);

					for (var n = 0; n <= 1; n++) {
						for (var h = 0.0; h <= 1.5; h += 0.5) {
							var plot = new dynamite.plots.OrbitPlot(pendulum, new dynamite.core.Point( (n * Math.PI) + ( n >= 0 ? h : -h), 0.0));
							plot.settings.lineWidth = 2.0;
							plot.settings.solverTF = 11.5;

							if (h == 0.0) plot.settings.showInitialPoint = true;

							app.model.add(plot);
						}
					}

					var plot = new dynamite.plots.OrbitPlot(pendulum, new dynamite.core.Point(2*Math.PI, 0.0));
					plot.settings.showInitialPoint = true;
					app.model.add(plot);

					for (var h = 2.5; h <= 3.0; h += 0.25) {
						var plot = new dynamite.plots.OrbitPlot(pendulum, new dynamite.core.Point(-4.0, h));
						plot.settings.lineWidth = 2.0;
						plot.settings.solverTF = 10.0;

						app.model.add(plot);
					}

					for (var h = -2.5; h >= -3.0; h -= 0.25) {
						var plot = new dynamite.plots.OrbitPlot(pendulum, new dynamite.core.Point(10.0, h));
						plot.settings.lineWidth = 2.0;
						plot.settings.solverTF = 5.0;
						console.log(plot);
						app.model.add(plot);
					}

					break;
				case 'lotka-volterra':
					var dx = Parser.parse('x - (x*y)');
					dx.formula = 'x - x*y';
					var dy = Parser.parse('-y + (x*y)');
					dy.formula = '-y + x*y';

					app.canvas.setViewLimits(-3.0, 4.0, -0.5, 4.0);

					var lotkavolterra = new dynamite.core.ODEParsedSystem(dx, dy);
					var slopeField = new dynamite.plots.SlopeField(lotkavolterra);
					slopeField.settings.lineWidth = 1.0;
					slopeField.settings.useArrows = true;
					slopeField.settings.density = 15;
					slopeField.enabled = false;

					app.model.add(slopeField);

					for (var h = -2.0; h <= 3.5; h += 0.5) {
						var plot = new dynamite.plots.OrbitPlot(lotkavolterra, new dynamite.core.Point(h, h >= 0 ? 1.5 : 3.0));
						plot.settings.lineWidth = 2.0;
						plot.settings.solverTF = 8.5;

						app.model.add(plot);
					}		

					break;
				case 'vanderpol':
					var dx = Parser.parse('y');
					dx.formula = 'y';
					var dy = Parser.parse('(1-x^2)*y - x');
					dy.formula = '(1-x^2)*y - x';

					var vanderpol = new dynamite.core.ODEParsedSystem(dx, dy);
					var slopeField = new dynamite.plots.SlopeField(vanderpol);
					slopeField.settings.lineWidth = 1.0;
					slopeField.settings.useArrows = true;
					slopeField.settings.density = 15;
					slopeField.enabled = false;

					app.model.add(slopeField);

					for (var h = 0.0; h <= 3.5; h += 0.5) {
						var plot = new dynamite.plots.OrbitPlot(vanderpol, new dynamite.core.Point(h, 0.0));
						plot.settings.lineWidth = 2.0;
						plot.settings.solverTF = 8.0;
						plot.settings.showInitialPoint = true;

						app.model.add(plot);
					}

					break;
				case 'juliaset':
				app.canvas.setViewLimits(-2.5, 2.5, -1.5, 1.5);
					var juliaset = new dynamite.plots.JuliaSetPlot(new dynamite.core.Point(0.285, 0.01));
					// var juliaset = new dynamite.plots.JuliaSetPlot(new dynamite.core.Point(-0.835, -0.2321));
					app.model.add(juliaset);
				default:
					break;
			}

		});

		// $('#dynamite-toolbar a.examples[data-example="juliaset"]').click();

	});

})(jQuery);