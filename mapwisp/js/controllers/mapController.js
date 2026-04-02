app.controller("MapsController", function (
	$rootScope,
	$scope,
	$timeout,
	Locations,
	dialogService,
	Map,
	Translation,
	Users,
	Functions,
	Validation,
	Regions,
	RegionReports,
	Chat,
	Projects,
	Groups,
	Notes,
	Clients,
	AccessPoints,
	Cables,
	Reserves,
	Posts,
	Connections,
	Fusions,
	FusionsReport,
	Materials,
	Ruler,
	Views,
	DefaultValues,
	Nodes,
	Painel,
	Markers,
	MarkerImage,
	Buildings,
	LevelsAndModes,
	Onus,
	Financial,
	Tour,
	ErpIntegration,
	SmartOlt,
    IntegraOlt,
	LiveLocation,
    Surveys,
	Tips,
    ItemImages
) {

	$rootScope.Translation = Translation;
	$rootScope.map = Map;
	$rootScope.FusionsReport = FusionsReport;
	$rootScope.dialogService = dialogService;
	$rootScope.Connections = Connections;
	$rootScope.Ruler = Ruler;
	$rootScope.Fusions = Fusions;
	$rootScope.viewAllRegions = false;
	$rootScope.showRoadNames = true;
	$rootScope.dotsCount = 0;
	$rootScope.data = [];
	$rootScope.data.search = "testes";
	$rootScope.window = window;
	$rootScope.analytics_timing = {};
	$rootScope.treeview = true;
	$rootScope.Tour = Tour;
    $rootScope.Surveys = Surveys;
    $rootScope.ItemImages = ItemImages;

	$scope.getCsrfToken = function() {
		$.ajax({
			url: $rootScope.base_url + "/csrf/token",
			type: "GET",
			async: false,
			success: function(data) {
				console.log("csrf success", data);
			},
			complete: function() {
				console.log("csrf complete");
			}
		});
	}

	$scope.initialize = function (base_url) {
		$(".jstree-sidebar").css("height", window.innerHeight * 0.95);
		//START COUNTING GOOGLE ANALYTICS TIME
		$rootScope.analytics_timing.start = new Date().getTime();

		//Setar url base para chamar API
		$rootScope.base_url = base_url;

		$rootScope.initial_loading = true;

        // Helper to read cookie
        $scope.getCsrfToken();
        $rootScope.getCookie = function(name) {
            let value = "; " + document.cookie;
            let parts = value.split("; " + name + "=");
            let cookie = "";
            if (parts.length === 2) {
                cookie = decodeURIComponent(parts.pop().split(";").shift());

            }
            return cookie;
        }

        Cables.getCableErrors();

		//Buscar usuario atual

		$rootScope.Users = Users;
		Users.getCurrentUser();
		if(LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_TECNICO]) ||
                LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR])){
			Map.updateCableLength(true);
		}

		//Buscando dados do usuario
		link = $rootScope.base_url + "/profiles/get_all";
		$.ajax({
			url: link,
			type: "GET",
            async: false,
			success: function (data) {
				$rootScope.user_data = data;
			},
			complete: function () {
				$rootScope.$digest();
				if(!$rootScope.user_data){
					user_data_array = {};
					user_data_array.user_setting = {};
					user_data_array.user_setting.show_cables = true;
					user_data_array.user_setting.show_cx_em = true;
					user_data_array.user_setting.show_cx_at = true;
					user_data_array.user_setting.show_racks = true;
					user_data_array.user_setting.show_pacs = true;
					user_data_array.user_setting.show_cameras = true;
					user_data_array.user_setting.show_clients = true;
					user_data_array.user_setting.show_posts = true;
					user_data_array.user_setting.show_buildings = true;
					user_data_array.user_setting.show_deployeds = true;
					user_data_array.user_setting.show_undeployeds = true;
                    user_data_array.user_setting.vector_map = true;
                    user_data_array.user_setting.show_tips = false;
					user_data_array.user_setting.currency_symbol = 1;
					user_data_array.user_setting.show_cable_types_json = [];
					user_data_array.user_setting.show_post_groups_json = [];
					$rootScope.user_data = user_data_array;
				}
			},
            error: function() {
                if(!$rootScope.user_data){
					user_data_array = {};
					user_data_array.user_setting = {};
					user_data_array.user_setting.show_cables = true;
					user_data_array.user_setting.show_cx_em = true;
					user_data_array.user_setting.show_cx_at = true;
					user_data_array.user_setting.show_racks = true;
					user_data_array.user_setting.show_pacs = true;
					user_data_array.user_setting.show_cameras = true;
					user_data_array.user_setting.show_clients = true;
					user_data_array.user_setting.show_posts = true;
					user_data_array.user_setting.show_buildings = true;
					user_data_array.user_setting.show_deployeds = true;
					user_data_array.user_setting.show_undeployeds = true;
                    user_data_array.user_setting.vector_map = true;
					user_data_array.user_setting.currency_symbol = 1;
					user_data_array.user_setting.show_cable_types_json = [];
					user_data_array.user_setting.show_post_groups_json = [];
					$rootScope.user_data = user_data_array;
				}
            }
		});

		//Setar variaveis para menu superior do mapa
		$rootScope.break_point_left = 1060;
		$rootScope.break_point_right = 1300;
		$rootScope.break_point_logo_top = 830;
		$rootScope.break_point_logo_bottom = 640;

		window.scrollTo(0, 0);
		$("body").css("overflow-y", "hidden");
		$("body").css("overflow-x", "hidden");
		latLng = new google.maps.LatLng(-25.33668840429151, -49.960327151056845);
		var mapOptions = {
			controlSize: 30,
			zoom: 15,
			center: latLng,
			mapTypeId: $rootScope.user_data.user_setting ? $rootScope.user_data.user_setting.map_type : google.maps.MapTypeId.ROADMAP,
			disableDoubleClickZoom: true,
			panControl: true,
			zoomControl: true,
			mapTypeControl: true,
			scaleControl: true,
			streetViewControl: true,
			overviewMapControl: true,
			rotateControl: true,
			minZoom: 0,
			draggableCursor: "crosshair",
			gestureHandling: "greedy",

            tilt: 0,
            heading: 0,
		};

		if($rootScope.user_data.user_setting && $rootScope.user_data.user_setting.vector_map){
			mapOptions.mapId= "7a2913317a7f6347";
		}

		// Criando o mapa
		Map.map = new google.maps.Map(document.getElementById("map"), mapOptions);
        $scope.createMapControlButtons(Map.map);

        if ($rootScope.user_data.user_setting 
            && $rootScope.user_data.user_setting.map_type 
            && $rootScope.user_data.user_setting.map_type.toLowerCase() == "osm"){
            $scope.setOSM();
        }

		// Removendo infos desnecessarias no mapa
        // Deve permanecer para mapa raster
		var styleArray = [
			{
				featureType: "poi",
				stylers: [
					{ visibility: "off" }
				]
			},
			{
				featureType: "road",
				stylers: [
					{ visibility: "on" }
				]
			}
		];
		Map.map.setOptions({ styles: styleArray });

        // React to rotation changes, updating the windrose icon
        google.maps.event.addListener(Map.map, "heading_changed", function(event){
            document.getElementById("map-control-ui-reset").style.transform = "rotate(-" + Map.map.getHeading() + "deg)";
        });

		// Setando listener do click direito do mouse no mapa
		google.maps.event.addListener(Map.map, "rightclick", function (event) {
			
			$rootScope.Cables.offEditCablePolyline();
			
			//acessa a função do serviço
			if(LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_TECNICO]) ||
                LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR]) || LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_COMERCIAL]) || LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_VIEW])){
				//if($rootScope.Projects.projectSelected){
				Map.rightClick(event);
				AccessPoints.typeList();
			} else if (LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_VIEWEXPORT])){
                Map.viewExportRightClick(event);
            }
		});

		//Setando listener do click esquerdo do mouse no mapa
		google.maps.event.addListener(Map.map, "click", function (event) {
			//acessa a função do serviço
			Map.click(event);
		});

		// Listing Onus as early as possible
		// The onu objects are needed to set client colors
		$rootScope.Onus = Onus;
		Onus.viewONUs();

		//fazer buscas e setar sevices
		$rootScope.Locations = Locations;
		Locations.locationList(true);

		$rootScope.Painel = Painel;
		Painel.get_company();

		// Support Chat initialization
		$rootScope.Chat = Chat;

		$rootScope.Projects = Projects;
		Projects.list(true);

		$rootScope.Groups = Groups;
		Groups.list();

		$rootScope.Regions = Regions;
		Regions.list();

		$rootScope.RegionReports = RegionReports;

		$rootScope.Notes = Notes;
		Notes.list(false);

		$rootScope.Clients = Clients;
		Clients.list(false);
		Clients.listRouterTypes();

		$rootScope.AccessPoints = AccessPoints;
		AccessPoints.typeList(true);//true para depois que listar os tipo, ele listar os access_points

		$rootScope.Cables = Cables;
		Cables.typeList(true);//para listar cabps apos listar tipos

		Cables.colorCodesList();

		$rootScope.Reserves = Reserves;
		Reserves.list(false);

		$rootScope.Posts = Posts;
		Posts.list(false);

		$rootScope.Views = Views;
		Views.list();

		$rootScope.DefaultValues = DefaultValues;
		DefaultValues.list();

		$rootScope.Materials = Materials;
		Materials.listKits();
		Materials.listMaterials();

		Connections.findHostTypes();

		$rootScope.Nodes = Nodes;
		Nodes.list();

		$rootScope.Markers = Markers;
		Markers.init();

		$rootScope.MarkerImage = MarkerImage;

		$rootScope.Buildings = Buildings;
		Buildings.list();

		$rootScope.Financial = Financial;

		$rootScope.ErpIntegration = ErpIntegration;

		$rootScope.SmartOlt = SmartOlt;
        $rootScope.SmartOlt.initialize();

        $rootScope.IntegraOlt = IntegraOlt;
        $rootScope.IntegraOlt.initialize();

		$rootScope.LiveLocation = LiveLocation;

		$rootScope.Tips = Tips;
		$rootScope.Tips.getTips();

		//pegar a localização atual do navegador
		if (navigator.geolocation && !$rootScope.Locations.defaultLocationSet) {
			navigator.geolocation.getCurrentPosition(function (position) {
				initialLocation = new google.maps.LatLng(position.coords.latitude, position.coords.longitude);
				if (!$rootScope.Locations.defaultLocationSet) {
					Map.map.setCenter(initialLocation);
				}
			});
		}

		//Inicializando posicoes de barras de botoes para telas pequenas
		if (window.innerWidth <= 1705) {
			$(".treeview-toggle-button-active").each(function () {
				$(this).addClass("toggle-btn-size-2");
			});
			$(".treeview-toggle-button").each(function () {
				$(this).addClass("toggle-btn-size-2");
			});
		}
		//escuta mudancas na largura da tela, para ajeitar posicao da barra de views
		$(window).resize(function () {
			$scope.$apply(function () {
				$(".jstree-sidebar").css("height", window.innerHeight * 0.95);
				if (window.innerWidth <= 1705) {
					$(".treeview-toggle-button-active").each(function () {
						$(this).addClass("toggle-btn-size-2");
					});
					$(".treeview-toggle-button").each(function () {
						$(this).addClass("toggle-btn-size-2");
					});
				} else if (window.innerWidth > 1705) {
					$(".treeview-toggle-button-active").each(function () {
						$(this).removeClass("toggle-btn-size-2");
					});
					$(".treeview-toggle-button").each(function () {
						$(this).removeClass("toggle-btn-size-2");
					});
				}
			});
		});

		$scope.init_map_search_box(Map);

		//Listen do keyboard events, and takes action accordingly
		google.maps.event.addDomListener(document, "keyup", function (e) {
			var code = (e.keyCode ? e.keyCode : e.which);
			if (code === 27) {
				if (Cables.editing) {
					Cables.editPolyline(Cables.editing_cable);
				}
			}
		});

		//GOOGLE ANALYTICS------------------------------------------------------------------
		if ($rootScope.run_analytics) {
			(function (i, s, o, g, r, a, m) {
			i["GoogleAnalyticsObject"] = r; i[r] = i[r] || function () {
				(i[r].q = i[r].q || []).push(arguments)
			}, i[r].l = 1 * new Date(); a = s.createElement(o),
				m = s.getElementsByTagName(o)[0]; a.async = 1; a.src = g; m.parentNode.insertBefore(a, m)
			})(window, document, "script", "https://www.google-analytics.com/analytics.js", "ga");
			ga("create", "UA-REPLACE-WITH-YOUR-ID", "auto", {
				userId: $rootScope.Users.current_user ? $rootScope.Users.current_user.company.company_name : null
			});
			ga("set", "page", "/mapa");
			ga("send", "pageview");
		}
		//GOOGLE ANALYTICS------------------------------------------------------------------
	};

    /**
     * Create buttons on map for tilt and heading controls
     */
     $scope.createMapControlButtons = function(map) {
        // Map Control Buttons
        const mapButtons = [
            ["", "toggle", 0, google.maps.ControlPosition.RIGHT_BOTTOM, "map-control-ui-toggle"],
            ["spinner.svg", "rotate", 20, google.maps.ControlPosition.RIGHT_BOTTOM, "map-control-ui-rotate-left"],
            ["spinner.svg", "rotate", -20, google.maps.ControlPosition.RIGHT_BOTTOM, "map-control-ui-rotate-right"],
            ["arrow_down.svg", "tilt", 20, google.maps.ControlPosition.RIGHT_BOTTOM, "map-control-ui-tilt-down"],
            ["arrow_up.svg", "tilt", -20, google.maps.ControlPosition.RIGHT_BOTTOM, "map-control-ui-tilt-up"],
            ["windrose.svg", "reset", 0, google.maps.ControlPosition.RIGHT_BOTTOM, "map-control-ui-reset"],
        ];
        mapButtons.forEach(([icon, mode, amount, position, id]) => {

			if($rootScope.user_data.user_setting && $rootScope.user_data.user_setting.vector_map 
				|| mode === "toggle"){

				const controlDiv = document.createElement("div");
				const controlUI = document.createElement("button");
				const controlIcon = document.createElement("span");
				controlIcon.classList.add("map-control-icon");
				controlIcon.setAttribute("id", id);

				if(mode === "toggle"){
					controlIcon.classList.add("material-icons");
					controlUI.style.padding = "10px 0 5px 0";
					controlUI.style.textAlign = "center";
					controlUI.style.fontSize = "10px";
					controlUI.textContent = "Vetor";
					icon = ($rootScope.user_data.user_setting && $rootScope.user_data.user_setting.vector_map) ? "toggle_on" : "toggle_off";
					controlIcon.innerText = `${icon}`;
				}else{
					const controlImg = document.createElement("img");
					controlImg.setAttribute("src", $rootScope.base_url + "/img/icons_map/" + icon);
					if(id === "map-control-ui-rotate-left"){
						controlImg.style.transform= 'scaleX(-1)';
					}				
					controlIcon.appendChild(controlImg);
				}

				controlUI.appendChild(controlIcon);
				controlUI.classList.add("map-ui-button");
				controlUI.addEventListener("click", () => {
				adjustMap(mode, amount);
				});
				controlDiv.appendChild(controlUI);

			   	map.controls[position].push(controlDiv);
			}
        });
        
        const adjustMap = function (mode, amount) {
            switch (mode) {
                case "tilt":
                    map.setTilt(map.getTilt() + amount);
                    break;
                case "rotate":
                    map.setHeading(map.getHeading() + amount);
                    break;
                case "reset":
                    map.setHeading(0);
                    map.setTilt(0);
                    break;
                case "toggle":
                    var options = {
						autoOpen: false,
						modal: true,
						title: $rootScope.Users.translateText('Atenção'),
						width: 300,
						height:'auto',
						resizable:true,
						dialogClass: "noclose", 
					};
					
					model = [];  
					dialogService.open('mapReload','mapReload', model, options).then();

                    break;
                default:
                    break;
            }
        };
    };

	$scope.mapReload = function () {

		link = $rootScope.base_url+'/Profiles/edit'
		$.post(link, 
			{
				user_setting:
				{
					vector_map:($rootScope.user_data.user_setting && $rootScope.user_data.user_setting.vector_map) ? false : true,
				}
			},
			function(data) {
				if(data.status == 1){
                    // Send analytics event about map type change
                    if ($rootScope.run_analytics) {
						ga("send", {
							hitType: "event",
							eventCategory: "Map",
							eventAction: "change_map_type",
							eventLabel: "Change to " + 
                                        (($rootScope.user_data.user_setting && $rootScope.user_data.user_setting.vector_map) ? "raster" : "vector") 
                                        + "map"
						});
					}

					window.location.reload(true);
				}else{
					$rootScope.message_error = data.message_error;						
				}					
				$rootScope.$apply();					
			}
		);
	},

    $scope.checkIfStringIsCoordinates = function(str) {
        const regex = new RegExp("^\\s*([-+]?(?:[1-8]?\\d(?:\\.\\d+)?|90(?:\\.0+)?))\\s*,\\s*([-+]?(?:180(?:\\.0+)?|(?:1[0-7]\\d|[1-9]?\\d)(?:\\.\\d+)?))$", "gm");
        var m;
		var matched = false;
		var matchGroups = [];
        while ((m = regex.exec(str)) !== null) {
            // This is necessary to avoid infinite loops with zero-width matches
            if (m.index === regex.lastIndex) {
                regex.lastIndex++;
            }
            
            // The result can be accessed through the `m`-variable.
            m.forEach((match, groupIndex) => {
				matched = true;
				matchGroups[groupIndex] = match;
            });
        }
        return {
			"matched": matched,
			"matchGroups": matchGroups
		};
    },

	/**
	 *  Initialize Address Search Box (Endereco)
	 **/
	$scope.init_map_search_box = function (Map) {
		// Create the search box and link it to the UI element.
		var input = document.getElementById("search-address");
		// Map.map.controls[google.maps.ControlPosition.TOP_LEFT].push(input);

		// Define searchbox action
		$("#search-address").on("keydown", function(e) {
			if (e.which == 13) {
                // Check if text is coordinates
                let regexResult = $scope.checkIfStringIsCoordinates($("#search-address").val());
				if (regexResult.matched){
                    let geometry = {
                        "textSearch": $("#search-address").val(),
                        "location": {
                            "lat": parseFloat(regexResult.matchGroups[1]),
                            "lng": parseFloat(regexResult.matchGroups[2])
                        }
                    };
                    $scope.showFoundLocation(geometry);
                    return;
				}

				// pressed enter - start search
				var geometry = null;
				// Request to backend to get location
				$rootScope.map.isLoading = true;
				$rootScope.$apply();
				var dataSend = {};
				dataSend.textSearch = $("#search-address").val();
				link = $rootScope.base_url + "/maps/get_location_text",
				$.ajax({
					url: link,
					data: dataSend,
					type: "POST",
					success: function (data) {
						$rootScope.map.isLoading = false;
						$rootScope.$apply();
						console.log(data);
						if (data.status === 1){
							geometry = data.data;
							$scope.showFoundLocation(geometry);
						} else {
							return;
						}
					}
				});
			}
		});
	},

	// Show location when found by searchbox backend call
	$scope.showFoundLocation = function(geometry, viabilidade){
		if (typeof geometry === "undefined"){
			return;
		}
		var locationMap = null;
		if (viabilidade) {
			locationMap = Map.mapViabilidade;
			console.log(" = mapViabilidade");
		} else {
			locationMap = Map.map;
			console.log(" = map");
		}

		console.log("locationMap: ", locationMap);

		// Setar centro do mapa para localizacao encontrada
		locationMap.setCenter(geometry.location);

		// Definir limites do mapa de acordo com tamanho da localizacao
		var bounds = new google.maps.LatLngBounds();
		if (geometry.viewport) {
			// Only geocodes have viewport.
			bounds.union(new google.maps.LatLngBounds(geometry.viewport.southwest, geometry.viewport.northeast));
		} else {
			bounds.extend(geometry.location);
		}
		locationMap.fitBounds(bounds);

		// Show marker at found location, and hide after 3 seconds
		console.log(geometry);
		label = null;
		if (viabilidade) {
			label = {
				text: geometry.textSearch,
				color: "black",
				fontWeight: "bold",
				fontSize: "14px"
			};
		}
		var icon = {
				url: $rootScope.base_url+"/img/icons_map/loc_default.svg",
				size: new google.maps.Size(71, 71),
				origin: new google.maps.Point(0, 0),
				anchor: new google.maps.Point(17, 34),
				scaledSize: new google.maps.Size(25, 25)
		};
		var marker = new google.maps.Marker({
			icon : icon,
			position: new google.maps.LatLng(geometry.location.lat, geometry.location.lng),
			map: locationMap,
			title: "Geocode",
			draggable:false,
			label: label
	   	});



		// Remove marker on right click
		google.maps.event.addListener(marker, "rightclick", function(event) {
			if (!viabilidade) {
				marker.setMap(null);
			} else {
				// Should do something if pin is in viabilidade mode?
			}
		});

		//Send event to analytics
		if ($rootScope.run_analytics) {
			ga("send", {
				hitType: "event",
				eventCategory: "Map",
				eventAction: "search_place_backend"
			});
		}
	},

	$scope.initialize_window_report = function (base_url) {
		$rootScope.base_url = base_url;

		window.scrollTo(0, 0);
		$("body").css("overflow-y", "hidden");
		$("body").css("overflow-x", "hidden");
		latLng = new google.maps.LatLng(-25.33668840429151, -49.960327151056845);
		var mapOptions = {
			zoom: 15,
			tilt: 48,
			center: latLng,
			mapTypeId: google.maps.MapTypeId.ROADMAP,
			disableDoubleClickZoom: true,
			panControl: true,
			zoomControl: false,
			mapTypeControl: true,
			scaleControl: true,
			streetViewControl: true,
			overviewMapControl: true,
			rotateControl: true,
			minZoom: 0,
			draggableCursor: "crosshair",
			gestureHandling: "greedy"
		};

		//setando o mapa
		Map.map = new google.maps.Map(document.getElementById("map"), mapOptions);

		//pegar a localização atual do navegador - NAO EH NECESSARIO NO MAPA DO REPORT
		$rootScope.DefaultValues = DefaultValues;
		DefaultValues.list(true);

		//GOOGLE ANALYTICS------------------------------------------------------------------
		if ($rootScope.run_analytics) {
			(function (i, s, o, g, r, a, m) {
			i["GoogleAnalyticsObject"] = r; i[r] = i[r] || function () {
				(i[r].q = i[r].q || []).push(arguments)
			}, i[r].l = 1 * new Date(); a = s.createElement(o),
				m = s.getElementsByTagName(o)[0]; a.async = 1; a.src = g; m.parentNode.insertBefore(a, m)
			})(window, document, "script", "https://www.google-analytics.com/analytics.js", "ga");
			ga("create", "UA-REPLACE-WITH-YOUR-ID", "auto");
			ga("set", "page", "/window_report");
			ga("send", "pageview");
		}
		//GOOGLE ANALYTICS------------------------------------------------------------------
	};


	$scope.money_format = function (val) {
		return Functions.money_format(val, 2, 3, ".", ",");
	},

	/**
	 * Set map style to OSM
	 * */
	$scope.setOSM = function () {
		//Define OSM map type pointing at the OpenStreetMap tile server
		Map.map.mapTypes.set("OSM", new google.maps.ImageMapType({
			getTileUrl: function (coord, zoom) {
				// return "http://tile.openstreetmap.org/" + zoom + "/" + coord.x + "/" + coord.y + ".png";
				return "http://tile.openstreetmap.org/" + zoom + "/" + coord.x + "/" + coord.y + ".png";
			},
			tileSize: new google.maps.Size(256, 256),
			name: "OpenStreetMap",
			maxZoom: 18
		}));
		var mapOptions = {
			mapTypeId: "OSM",
		};
		Map.map.setOptions(mapOptions);
	};

    $scope.throttleTime = 10000; // 10s
    $scope.getViabilidadeTimeout = null;
    $scope.lastTimeoutStartTimeMS = null;

    $scope.getViabilidade = function() {
        if (!$scope.getViabilidadeTimeout){
            console.log(">> GETTING VIABILIDADE");
            $scope.getViabilidadeThrottled();
            $scope.lastTimeoutStartTimeMS = (new Date()).getTime();
		    $scope.getViabilidadeTimeout = setTimeout(() => {
                console.log(">> CLEARING VIABILIDADE TIMEOUT BLOCKING");
                $scope.getViabilidadeTimeout = null;
            }, $scope.throttleTime);
        } else {
            console.log(">> THROTTLING VIABILIDADE!");
            let timeElapsedMS = ((new Date()).getTime() - $scope.lastTimeoutStartTimeMS);
            let timeRemainingMS = $scope.throttleTime - timeElapsedMS;
            alert("Tente novamente em " + (timeRemainingMS/1000).toFixed(1) + " segundos.");
        }
    };

	/**
	 * Get Viabilidade
	 * */
	$scope.getViabilidadeThrottled = function () {
        //Send event to analytics
		if ($rootScope.run_analytics) {
			ga("send", {
				hitType: "event",
				eventCategory: "Map",
				eventAction: "Get Viability"
			});
		}

		// Open Modal!
		var options = {
			autoOpen: false,
			modal: true,
			title: "Viabilidade",
			width: 1000,
			height: 600,
			resizable: false,
		};
		model = [];
		$rootScope.dialogService.open("address-viabilidade", "address-viabilidade", model, options).then();

		var geometry = null;
		// Request to backend to get location
		$rootScope.viabilidadeLoading = true;
		$rootScope.map.isLoading = true;
		$rootScope.$apply();
		var dataSend = {};
		dataSend.textSearch = $("#search-address").val();
        link = $rootScope.base_url + "/clients/text_search_viabilidade",
		$.ajax({
			url: link,
			data: dataSend,
			type: "POST",
			success: function (data) {
				$rootScope.viabilidadeLoading = false;
				$rootScope.map.isLoading = false;

				$rootScope.$apply();
				if (data.status === 1){
					geometry = data.data.geometry;
					geometry.textSearch = dataSend.textSearch;

					// Inicializar MAPA dentro da Modal
					$scope.initMapViabilidade(geometry);

					// Mostrar itens no mapa de Viabilidade
					$scope.showViabilidade(data.data);
				} else {
					return;
				}
			}
		});
	};

	$scope.initMapViabilidade = function(geometry){
		latLng = new google.maps.LatLng(geometry.location.lat, geometry.location.lng);
		var mapOptions = {
			controlSize: 30,
			zoom: 15,
			tilt: 48,
			center: latLng,
			mapTypeId: $rootScope.user_data.user_setting ? $rootScope.user_data.user_setting.map_type : google.maps.MapTypeId.ROADMAP,
			disableDoubleClickZoom: true,
			panControl: true,
			zoomControl: true,
			mapTypeControl: true,
			scaleControl: true,
			streetViewControl: true,
			overviewMapControl: true,
			rotateControl: true,
			minZoom: 0,
			draggableCursor: "crosshair",
			gestureHandling: "greedy"
		};

		//setando o mapa
		Map.mapViabilidade = new google.maps.Map(document.getElementById("map-viabilidade"), mapOptions);
	};

	/**
	 * Show viability items on the viability map.
	 * 
	 * @param {obj} viabilidadeData 
	 */
	$scope.showViabilidade = function(viabilidadeData){
		var geometry = viabilidadeData.geometry;
		var viabilityOptions = viabilidadeData.viability;

		// Set map center to address found
		Map.mapViabilidade.setCenter(geometry.location);

		// Show marker at the location found for the given address
		var locationMarker = $scope.getArbitraryLocationMarker(geometry.textSearch, geometry.location.lat, geometry.location.lng)
		locationMarker.setMap(Map.mapViabilidade);

		// Create bounds to show all items, and add central marker
		var bounds = new google.maps.LatLngBounds();
		bounds.extend(geometry.location);

		for (let i = 0; i < viabilityOptions.length; i++) {
			var option = viabilityOptions[i];

			// Draw Marker
			var marker = Map.drawSimpleMarker(option.name, option.icon, option.dot.lat, option.dot.lng);
			marker.setMap(Map.mapViabilidade);
			Map.addListenerViabilityAccessPoint(option, marker);

			// Draw Polyline
			var path = [];
			for (let j = 0; j < option.drop_dots.length; j++) {
				const drop_dot = option.drop_dots[j];
				const dot = new google.maps.LatLng(drop_dot.lat, drop_dot.lng);
                path.push(dot);
			}
			var dropOptionLength = Map.calculateLengthObject(path);
			
			var polyline = Map.drawPolyline(path, "Cabo DROP - " + dropOptionLength + " metros", "#000", false);
			polyline.setMap(Map.mapViabilidade);

			polyline.length = dropOptionLength;
			Map.addListenerViabilityDropCable(polyline);

			// Add to bounds
			bounds.extend(option.dot);
		}

		if (viabilityOptions.length === 0) {
			$rootScope.noApOptionsFound = true;
			$rootScope.$apply();
		}

		// Definir limites do mapa de acordo com tamanho da localizacao
		Map.mapViabilidade.fitBounds(bounds);
	};

	/**
	 * Generate and return general location marker to be used
	 * by any function or service.
	 */
	$scope.getArbitraryLocationMarker = function(labelText, lat, lng){
		var label = {
			text: labelText,
			color: "black",
			fontWeight: "bold",
			fontSize: "14px"
		};
		var icon = {
			url: $rootScope.base_url+"/img/icons_map/loc_default.svg",
			size: new google.maps.Size(71, 71),
			origin: new google.maps.Point(0, 0),
			anchor: new google.maps.Point(17, 34),
			scaledSize: new google.maps.Size(25, 25)
		};
		var marker = new google.maps.Marker({
			icon : icon,
			position: new google.maps.LatLng(lat, lng),
			title: "Geocode",
			draggable:false,
			label: label
	   	});
		return marker;
	}

	/**
	 * Remove last dot from dotsTemp
	 * */
	$scope.removeLastDot = function (type) {
		//remover o ultimo item do vetor temporário acontece nos cabos e no shape
		if ($rootScope.tempPath.length > 0 && $rootScope.dotsTemp.length > 0) {
			$rootScope.dotsTemp[$rootScope.dotsTemp.length - 1].setMap(null);
			$rootScope.tempPath.pop();
			$rootScope.dotsTemp.pop();
			$rootScope.dotsCount--;
		}

		if (type == 1) {
			//shapes
			$rootScope.shapeTemp.setPath($rootScope.tempPath);
		} else if (type == 2) {
			//cabos
			if ($rootScope.finalizar) {
				$rootScope.finalizar = false;
			}

			$rootScope.metersCount = Map.calculateLengthObject($rootScope.tempPath);
			$rootScope.cableTemp.setPath($rootScope.tempPath);
		}
	}

	/**
	 * Verify quantity
	 * */
	$scope.verif_quantity = function (field) {
		if ($rootScope.form[field] == 0) {
			$rootScope.form[field] = 1;
		}
	}

	/**
	 * File Changed method
	 * This is a helper for the KMZ/KML upload function
	 * It just takes the data, and redirects it to the service.
	 * */
	$scope.file_changed = function () {
		Map.uploadKmzKml($scope.file[0]);
	}

	////////////////////////////////////////// TOOLS MODAL //////////////////////////////////////////////////////////

	$scope.toolsOpen = function () {
		if ($rootScope.tools) {
			$rootScope.tools = false;
			$rootScope.dialogService.cancel("tools");
		} else {
			var options = {
				autoOpen: false,
				modal: false,
				title: "Itens do mapa",
				width: "auto",
				height: 350,
				resizable: true,
				position: {
					my: "left top",
					at: "left+10 top+80",
					of: window,
					collision: "none"
				},
				create: function (event, ui) {
					$(event.target).parent().css("position", "fixed");
				},
				close: function () {
					$rootScope.tools = false;
				}
			};
			model = [];
			$rootScope.tools = true;
			$rootScope.dialogService.open("tools", "tools", model, options).then();
		}
	}

	$scope.toogleAccordion = function (tab) {
		if ($rootScope[tab]) {
			$rootScope[tab] = false;
		} else {
			$rootScope[tab] = true;
		}
	}

	$scope.mouseDown = function (e) {
		mouse = [];
		mouse.mouseX = e.pageX;
		mouse.mouseY = e.pageY;
		$rootScope.mouse = mouse;
	}

	$scope.close = function (id) {
		$rootScope.dialogService.close(id);
	}

	//////////////////////////////////////////////////////////////  FUNCTIONS /////////////////////////////////////////////////////////////

	$rootScope.toggleRoadNames = function () {
		if ($rootScope.showRoadNames) {
			new_status = "off";
			$rootScope.showRoadNames = false;
		} else {
			new_status = "on";
			$rootScope.showRoadNames = true;
		}
		var styleArray = [
			{
				featureType: "poi",
				stylers: [
					{ visibility: "off" }
				]
			},
			{
				featureType: "road",
				elementType: "labels",
				stylers: [
					{ visibility: new_status }
				]
			}
		];
		Map.map.setOptions({ styles: styleArray });
	},

		$rootScope.set_errors_modal = function (data, modal_id, keep_open) {
			if (data.status == 1) {
				$scope.message_success_modal = data.message;
				$timeout(function () {
					$rootScope.message_success_modal = "";
					if (!keep_open) {
						$rootScope.dialogService.close(modal_id);
					}
				}, 2000);
			} else {
				$rootScope.message_error_modal = data.message;
				$rootScope.$apply();
				if (typeof (data.errors._extras) != "undefined") {
					$rootScope.message_error_modal += data.errors._extras;
				}
				angular.forEach(data.errors, function (val, index) {
					$rootScope.form.error[index] = val;
				});
				$timeout(function () {
					$rootScope.message_error_modal = "";
				}, 4000);
			}
		}

	$rootScope.set_message = function (data) {
		if (data.status == 1) {
			$scope.message_success = data.message;
			$timeout(function () {
				$scope.message_success = "";
			}, 2000);
		} else {
			$rootScope.message_error = data.message;
			if ($scope(data.errors._extras) != "undefined") {
				$rootScope.message_error += data.errors._extras;
			}
			$timeout(function () {
				$scope.message_error = "";
			}, 2000);
		}
	}

	$rootScope.alert_message = function (message) {


		var options = {
			autoOpen: false,
			modal: true,
			title: "Atenção",
			width: 300,
			height: "auto",
			resizable: true,
			dialogClass: "noclose alertModal",
		};
		$rootScope.messageAlert = message;
		model = [];
		$rootScope.dialogService.open("alertModal", "alertModal", model, options).then();
		return;
	}


	$rootScope.validateIp = function (ip, tipo) {
		if (!Validation.validateIp(ip, tipo)) {
			if (tipo == "ipv6") {
				$rootScope.form.error.ipv6 = "Endereço " + tipo + " inválido(Não é obrigatório)";
			} else {
				$rootScope.form.error.ipv4 = "Endereço " + tipo + " inválido(Não é obrigatório)";
			}
		} else {
			if (tipo == "ipv6") {
				$rootScope.form.error.ipv6 = "";
			} else {
				$rootScope.form.error.ipv4 = "";
			}
		}
	}

	$rootScope.validateMacAddress = function (mac) {
		if (!Validation.validateMacAddress(mac)) {
			$rootScope.form.error.mac_address = "Mac address inválido";
		} else {
			$rootScope.form.error.mac_address = "";
		}
	}


});
