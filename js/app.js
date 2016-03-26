(function(){

	const GOOGLE_API_KEY = 'AIzaSyAJa2UEw3B5U094xUBsbnCOljf-GJDvnBc';
	// ex: 'https://maps.googleapis.com/maps/api/geocode/json?address=1600+Amphitheatre+Parkway,+Mountain+View,+CA&key=YOUR_API_KEY'
	const GOOGLE_API_HOST = 'https://maps.googleapis.com/maps/api/geocode/json?';


	var app = angular.module('ritualTime',['ui.bootstrap', 'ngMap', 'uiGmapgoogle-maps'])
		.config(function(uiGmapGoogleMapApiProvider) {
		uiGmapGoogleMapApiProvider.configure({
			key: GOOGLE_API_KEY,
			v: '3.20', //defaults to latest 3.X anyhow
			libraries: 'places'
		});
	});

	app.directive('pressEnter', function () {
		return function (scope, element, attrs) {
			element.bind("keydown keypress", function (event) {
				if(event.which === 13) {
					scope.$apply(function (){
						scope.$eval(attrs.pressEnter);
					});
					event.preventDefault();
				}
			});
		};
	});



	var appData = {};

	app.filter('durationTime', function() {
		return function(ms) {
			return moment.duration(ms).hours() + ':' + moment.duration(ms).minutes();
		};
	});

	app.service('calendar', function() {
		var currentDate = moment();
		

		this.setCurrentDate = function (date) {			
			currentDate = moment(date);			
		};

		this.getCurrentDate = function () {
			return currentDate;
		};		
	});

	
	app.service('solarPosition', function($http, $rootScope, calendar){
		var _this = this;
		var currentDate;
		var reqParam = {};
		var todaySunCalcObj, tomorrowSunCalcObj;

		var localData = {};

		this.getDayRiseFall = function () {

			currentDate = calendar ? calendar.getCurrentDate() : moment();
			
			appData.sunRiseFallParam = {};


			if (appData.geolocation != null) {				

				todaySunCalcObj = SunCalc.getTimes(currentDate.toDate(), appData.geolocation.lat, appData.geolocation.lon);
				tomorrowSunCalcObj = SunCalc.getTimes(currentDate.clone().add(1,'day').toDate(), appData.geolocation.lat, appData.geolocation.lon);

				
				appData.sunRiseFallParam.todaySunrise = moment(todaySunCalcObj.sunrise);
				appData.sunRiseFallParam.todaySunset = moment(todaySunCalcObj.sunset);
				appData.sunRiseFallParam.tomorrowSunrise = moment(tomorrowSunCalcObj.sunrise);


				$rootScope.$broadcast('sunRiseFallParamChanged');	
			}			
		}


		this.getGeoPosition = function (cb) {										    
			

	        var html5Options = { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 };
	        geolocator.locate(successCb, errorCb, true, html5Options, '');

	        function errorCb (error) {

	        	appData.geolocation = {
					error: err,
					city: 'Не определился'
				}

				if (typeof 'cb' == 'function') cb();
			}

			function successCb (location) {

				if (location == undefined) {

					appData.geolocation = {
						error: err,
						city: 'Не определился'
					};

					if (typeof 'cb' == 'function') cb();	
					return;
				}

				
				appData.geolocation = {
					city: location.address && location.address.city ? location.address.city : 'Не определен',
					lat: location.coords && location.coords.latitude ? location.coords.latitude : null,
					lon: location.coords && location.coords.longitude ? location.coords.longitude : null
				}


				if (typeof cb == 'function') cb();
			};			    
		}

		return this;
	});

	

	app.controller('solarCalcCtr', function ($scope, $rootScope, $http, solarPosition, calendar) {
		var _this = this;

		_this.geolocation = appData.geolocation || {};
		_this.sunRiseFallParam = appData.sunRiseFallParam || {};

		solarPosition.getGeoPosition(function(){
			geoPositionDetectHandler();
			$scope.$apply(); // Update only Once
		});

		function geoPositionDetectHandler() {
			setMapCoord();
			solarPosition.getDayRiseFall();
			checkRitualCurrentDay();
		}


		$scope.$on('sunRiseFallParamChanged', function(){
			sunRiseFallParamChanged();
		});

		$scope.$on('dateChange', function(){
			solarPosition.getDayRiseFall();
		});


		$scope.searchByAddress = function(address) {
			$http({
				method: 'GET',
				url: GOOGLE_API_HOST + 'address=' + address + '&KEY=' + GOOGLE_API_KEY
			}).then(function successCallback(response) {
				var results =  response && response.data && response.data.results && response.data.results.length ? response.data.results : undefined;

				if (results.length) {
					var coord = results[0].geometry.location;
					appData.geolocation = {
						city: address.length > 10 ? address.substring(0,10) + '...' : address,
						lat: results[0].geometry.location.lat,
						lon: results[0].geometry.location.lng
					};

					geoPositionDetectHandler();
				}

			}, function errorCallback(response) {

			});
		};


		function setMapCoord () {
			$scope.map = {
				center: {
					latitude: appData.geolocation.lat,
					longitude: appData.geolocation.lon
				},
				zoom: 14
			};
			$scope.options = {};
		}


		function checkRitualCurrentDay() {

			// debugger;

			// TODO: Fix calculate between time
			// if (moment().isBetween(moment(moment().startOf('day'),appData.sunRiseFallParam.tomorrowSunrise))) {
			// 	calendar.setCurrentDate(moment().subtract(1,'day'));
			// 	$rootScope.$broadcast('forceChangeDate');
			// }
		}


		
		function sunRiseFallParamChanged () {
			_this.geolocation = appData.geolocation;

			_this.sunRiseFallParam = appData.sunRiseFallParam;	
		
			_this.sunRiseFallParam.currentDate = calendar.getCurrentDate();

			
			_this.sunRiseFallParam.dayHour = calculateDayHour(_this.sunRiseFallParam.todaySunrise, _this.sunRiseFallParam.todaySunset);
			_this.sunRiseFallParam.nightHour = calculateNightHour(_this.sunRiseFallParam.tomorrowSunrise, _this.sunRiseFallParam.todaySunset);
			
		}
		


		function calculateDayHour (sunrise, sunset) {
			var sunrise = moment(sunrise);
			var sunset = moment(sunset);

			var duration = moment.duration( Math.abs(sunrise.diff(sunset)) / 12 );
			return duration;
		}

		function calculateNightHour (sunrise, sunset) {

			var sunrise = moment(sunrise);
			var sunset = moment(sunset);

			var duration = moment.duration( Math.abs(sunrise.diff(sunset)) / 12 );
			return duration;

		}

		
	});

	app.controller('dayTimeCtr', function($scope, $rootScope, calendar) {
		var _this = this;
		$scope.$on('sunRiseFallParamChanged', function(){
			sunRiseFallParamChanged();			
		})

		function sunRiseFallParamChanged () {
			var sunriseTime = moment(appData.sunRiseFallParam.todaySunrise).clone();

			var dayHour = moment.duration(appData.sunRiseFallParam.dayHour);

			var currentDate = calendar.getCurrentDate();


			_this.hours = [];
			for (h = 0, l = 12; h <l; h++) {



				var hour = {
					start: h == 0 ? sunriseTime.clone() : sunriseTime.add(dayHour).clone(),
					end: h == 0 ? sunriseTime.clone().add(dayHour).subtract(1,'minute') : sunriseTime.clone().add(dayHour).subtract(1,'minute'),
					planet: DAY[currentDate.day()][h]
				};

				hour.isCurrent = isCurrentTime(hour.start, hour.end);
				
				_this.hours.push(hour);
			}
		}
	})

	app.controller('nightTimeCtr', function($scope, calendar) {
		var _this = this;
		$scope.$on('sunRiseFallParamChanged', function(){
			sunRiseFallParamChanged();			
		})

		function sunRiseFallParamChanged () {
			var sunsetTime = moment(appData.sunRiseFallParam.todaySunset).clone();

			var nightHour = moment.duration(appData.sunRiseFallParam.nightHour);

			var currentDate = calendar.getCurrentDate();

			_this.hours = [];
			for (h = 0, l = 12; h <l; h++) {
				var hour = {
					start: h == 0 ? sunsetTime.clone() : sunsetTime.add(nightHour).clone(),
					end: h == 0 ? sunsetTime.clone().add(nightHour).subtract(1,'minute') : sunsetTime.clone().add(nightHour).subtract(1,'minute'),
					planet: NIGHT[currentDate.day()][h]					
				};

				hour.isCurrent = isCurrentTime(hour.start, hour.end)

				_this.hours.push(hour);
			}


		}
	})

	function isCurrentTime (start, end) {
		var current = moment();

		return current.isBetween(start,end);

	}


	app.controller('changeDateCtr', function($rootScope, $scope, calendar, solarPosition) {		
		$scope.visible = false;
		$scope.dt = calendar.getCurrentDate().toDate();

		var newDate;


		$scope.change = function(evt) {			
			calendar.setCurrentDate($scope.dt);
  			$rootScope.$broadcast('dateChange');
		}

		$scope.$on('forceChangeDate', function(){
			$scope.dt = calendar.getCurrentDate().toDate();
			$rootScope.$broadcast('dateChange');
		})
	});



	var DAY = [], NIGHT = [];

	// Sun
	DAY.push('Солнце Венера Меркурий Луна Сатурн Юпитер Марс Солнце Венера Меркурий Луна Сатурн'.split(' '));
	// Mon
	DAY.push('Луна Сатурн Венера Марс Солнце Венера Меркурий Луна Сатурн Юпитер Марс Солнце'.split(' '));
	// Tue
	DAY.push('Марс Солнце Венера Меркурий Луна Сатурн Юпитер Марс Солнце Венера Меркурий Луна'.split(' '));
	// Wed
	DAY.push('Меркурий Луна Сатурн Юпитер Марс Солнце Венера Меркурий Луна Сатурн Юпитер Марс'.split(' '));
	// Thu
	DAY.push('Юпитер Марс Солнце Венера Меркурий Луна Сатурн Юпитер Марс Солнце Венера Меркурий'.split(' '));
	// Fri
	DAY.push('Венера Меркурий Луна Сатурн Юпитер Марс Солнце Венера Меркурий Луна Сатурн Юпитер'.split(' '));
	// Sat
	DAY.push('Сатурн Юпитер Марс Солнце Венера Меркурий Луна Сатурн Юпитер Марс Солнце Венера'.split(' '));

	
	// Sun
	NIGHT.push('Юпитер Марс Солнце Венера Меркурий Луна Сатурн Юпитер Марс Солнце Венера Меркурий'.split(' '));
	// Mon
	NIGHT.push('Венера Меркурий Луна Сатурн Юпитер Марс Солнце Венера Меркурий Луна Сатурн Юпитер'.split(' '));
	// Tue
	NIGHT.push('Сатурн Юпитер Марс Солнце Венера Меркурий Луна Сатурн Юпитер Марс Солнце Венера'.split(' '));
	// Wed
	NIGHT.push('Солнце Венера Меркурий Луна Сатурн Юпитер Марс Солнце Венера Меркурий Луна Сатурн'.split(' '));
	// Thu
	NIGHT.push('Луна Сатурн Юпитер Марс Солнце Венера Меркурий Луна Сатурн Юпитер Марс Солнце'.split(' '));
	// Fri
	NIGHT.push('Марс Солнце Венера Меркурий Луна Сатурн Юпитер Марс Солнце Венера Меркурий Луна'.split(' '));
	// Sat
	NIGHT.push('Меркурий Луна Сатурн Юпитер Марс Солнце Венера Меркурий Луна Сатурн Юпитер Марс'.split(' '));


})()
