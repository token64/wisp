app.service('Buildings', function($rootScope, dialogService, Map, $timeout){

	var self  = {
			buildings: [],
			isLoading: false,
			buildingOpen: false,
			cablePaths: [],
			client_y_values : [],
			ap_x_values : [],
			current_cable_name : false,
			connectingAccessPoints : [],
			bulkEdit : false,
			bulkUndeploy : false,
			bulkDeploy : false,
			sharedDatabase: "",
			
			/**
			 * List method
			 * Makes an ajax call to list all buildings, and stores the returned data in the local
			 * array "buildings".
			 * */
			list : function(){
				self.isLoading = true;
				$.ajax({
					url:  $rootScope.base_url+'/buildings/list_all',
	      			type: 'POST',
	      			success: function(data){
	      				angular.forEach(data, function(building, building_idx){
	      					//building.deploy_information = data.deploy_information; 
	      					var icon_building = "";
							var deployed = false;

	      					if (building.deploy_information){
								if (building.deploy_information.deployed){
									icon_building = "predio_deployed.svg";
									deployed = true;
								}else{
									icon_building = "predio.svg";
								}
							}else{
								icon_building = "predio.svg";
							}
							
							//evita falha no carregamento caso haja um erro em prédios
							if(!building.dot){
                                console.warn("Building ERROR - no dot", building);
								return;
							}
			
							//Draw a marker for the building
	      					// building.marker = $rootScope.map.drawMarker(building.dot.lat, 
							// building.dot.lng, 0, icon_building, "Predio", building.name, false);

							building.marker = Map.drawSVGMarker(building.dot.lat, building.dot.lng, "building", building.name,
								"Predio", deployed, self.getBuildingColor(building), "black");
							 
							  //Add a listener for the building
	      					Map.addListenerBuilding(building);
	      					//Push the building to the local buildings array
	      					self.buildings.push(building);
	      				});
	      			},
	      			complete: function(){
						  self.isLoading = false;
						  $rootScope.Nodes.everythingLoaded("buildings");
	      			}
				});
			},

			organize_building_data: function (data) {
				angular.forEach(data, function(building, building_idx){
					//building.deploy_information = data.deploy_information; 
					var icon_building = "";
				  	var deployed = false;

					if (building.deploy_information){
						if (building.deploy_information.deployed){
							icon_building = "predio_deployed.svg";
							deployed = true;
						}else{
							icon_building = "predio.svg";
						}
					}else{
						icon_building = "predio.svg";
					}
				  
					//evita falha no carregamento caso haja um erro em prédios
					if(!building.dot){
						console.log(building);
						return;
					}
	
					//Draw a marker for the building
					building.marker = Map.drawSVGMarker(building.dot.lat, building.dot.lng, "building", building.name,
					  "Predio", deployed, self.getBuildingColor(building), "black");

					  if(building.sharedDatabase){
						building.marker.setDraggable(false);
					}
				   
					//Add a listener for the building
					Map.addListenerBuilding(building);
					//Push the building to the local buildings array
					self.buildings.push(building);
				});
			},

			getBuildingColor: function (building) {
				if (!building.color) {
					// If no color is set, set default grey
					building.color = "#c0c0c0";
				}
				return building.color;
			},

			/**
			 * Add method
			 * Opens a modal with a form to add a building
			 * */
			add : function(){
				var options = {
						autoOpen: false,
						modal: true,
						title: $rootScope.Users.translateText("Adicionar Prédio"),
						width: 400,
						height:'auto',
						resizable:true,
						dialogClass: "noclose", 
						position: {
							my: "center",
							at: "center",
							of: window,
							collision: "none"
						},
						close:function(){
							$rootScope.form = [];
						}    
					};
					model = [];
					$rootScope.form = [];
					$rootScope.form.error = [];
					//Set the location of the building being added
					if ($rootScope.map.serialAdding || $rootScope.map.KmzKmlImporting){
						$rootScope.form.lat = $rootScope.current_position.lat;
						$rootScope.form.lng = $rootScope.current_position.lng; 	
					} else {
						$rootScope.form.lat = $rootScope.event.latLng.lat();
						$rootScope.form.lng = $rootScope.event.latLng.lng();
					}
					
				  	if($rootScope.menuMap){
		                 $rootScope.menuMap = false;       
		                 $rootScope.dialogService.close('menuMap');
		            }
					dialogService.open('buildingAdd','buildingAdd', model, options).then();
			},

			/**
			 * Add confirm method
			 * Takes the information from the modal, and makes an ajax call to add
			 * the new building to the Database
			 * */
			addConfirm : function(){

                var dataSend = {};

				if(self.editing){
					link = $rootScope.base_url+'/buildings/edit'
					
					dataSend.id = $rootScope.form.id; 
					dataSend.name = $rootScope.form.name; 
					dataSend.color = $rootScope.form.color; 
				}else{
					link = $rootScope.base_url+'/buildings/add'   
					// Get JSON object with building data
					dataSend = self.generateBuildingData();
					dataSend.color = $rootScope.form.color;
				}
							
				$.ajax({
					url:  link,
	      			type: 'POST',
	      			data: dataSend,
	      			success: function(response){

	      				if(!self.editing){

							// Get new entity
							var new_building = response.data;

							// Create marker for the new building
							// new_building.marker = $rootScope.map.drawMarker(new_building.dot.lat, new_building.dot.lng, 0, "predio.svg", "Predio", new_building.name, false);
							// $rootScope.Markers.addToMap(new_building.marker);

							new_building.marker = Map.drawSVGMarker(new_building.dot.lat, new_building.dot.lng, "building", new_building.name,
								"Predio", false, self.getBuildingColor(new_building), "black");

							$rootScope.Markers.addToMap(new_building.marker);

							// Add new building to local buildings array
							self.buildings.push(new_building);

							// Add listener for the new building
							Map.addListenerBuilding(new_building);

							// Add Building node to the treeview
							self.addBuildingTreeView(new_building.id, new_building.name, self.buildings.length - 1);

						}else{

							/*for(var i = 0; i < self.buildings.length; i++){
								self.isLoading = true;
								if(self.buildings[i].id == response.data.id){
									self.buildings[i].name = response.data.name;
									$rootScope.Markers.removeFromMap(self.buildings[i].marker);
									$rootScope.Markers.addToMap(self.buildings[i].marker);

									$rootScope.Nodes.changeNodeName(9, self.buildings[i].id,self.buildings[i].name);
									Map.addListenerBuilding(self.buildings[i]);
								}
							}*/

							// When editing from treeview, $rootScope.selectedBuilding may not be set.
							// Also, deploy_information can be missing depending on backend response.
							var baseBuilding = $rootScope.selectedBuilding || $rootScope.form || {};
							var deployed = !!(baseBuilding.deploy_information && baseBuilding.deploy_information.deployed);
							var icone = deployed ? 'predio_deployed.svg' : 'predio.svg';

							// $rootScope.form.marker = Map.drawMarker($rootScope.form.dot.lat, 
							// $rootScope.form.dot.lng,$rootScope.form.dot.id,icone,
							// $rootScope.form.name,'',0);

							if ($rootScope.form && $rootScope.form.marker) {
								$rootScope.Markers.removeFromMap($rootScope.form.marker);
							}

							$rootScope.form.marker = Map.drawSVGMarker($rootScope.form.dot.lat, $rootScope.form.dot.lng, "building", $rootScope.form.name,
								"Predio", deployed, self.getBuildingColor($rootScope.form || baseBuilding), "black");

// 							$rootScope.Markers.removeFromMap($rootScope.form.marker);
							$rootScope.Markers.addToMap($rootScope.form.marker);

							$rootScope.Nodes.changeNodeName(9, $rootScope.form.id,$rootScope.form.name);

							$rootScope.form.floors = response.data.floors;
							
							Map.addListenerBuilding($rootScope.form);
							
	      				}
	      				
	      				// Close buildingAdd menu
	      				dialogService.close('buildingAdd');
	      			},
	      			complete: function(){}
				});
			},
			
			/**
			 * Generate Building Data Method
			 * Gets all necessary data from the form object, and generates the data
			 * needed to add a building to the Database.
			 * */
			generateBuildingData : function(){
				var buildingData = {};
				// Name
				buildingData.name = $rootScope.form.name;
				
				// Dot data
				buildingData.dot = {};
				buildingData.dot.lat = $rootScope.form.lat;
				buildingData.dot.lng = $rootScope.form.lng;
				
				//Floors and apartments
				buildingData.floors = {};
				for(var i = 0; i < $rootScope.form.floors; i++){
					var floor = {};
					//Name
					if (i == 0){
						floor.name = "T"
					} else {
						floor.name = "" + i;
					}
					
					//Number
					floor.floor_number = i;
					
					//Apartments
					floor.apartments = {};
					for(var j = 1; j <= $rootScope.form.apartments_by_floor; j++){
						var apartment = {};
						apartment.name = floor.name + "-" + j;
						apartment.apartment_number = j;
						floor.apartments[j-1] = apartment;
					}
					
					buildingData.floors[i] = floor;
				}
				return buildingData;
			},
			
			/**
			 * Add building tree view method
			 * Adds a new building to the treeview, and creates its node in the database
			 * */
			addBuildingTreeView : function(id, name, tomo_index){
				// Generate Node data
				node_data = {};
				node_data.parent_id = $rootScope.Nodes.saving_node_id;
				node_data.leaf = 1;
				node_data.selected = 1;
				node_data.checked = 1;
				node_data.category = 9;
				node_data.building_id = id;
				
				// Save node, and get the saved id
				var tomo_node_id = $rootScope.Nodes.addSync(node_data);
				
				// Set the icon
				icon = $rootScope.base_url + '/img/icons_map/predio.svg';
				
				// Add the node to the tree
				$rootScope.Nodes.addNoteToTree(id, tomo_node_id, $rootScope.Nodes.saving_node_id, icon, name, 9, tomo_index);
			},
			
			/**
			 * Remove building from tree view method
			 * Removes a building from the treeview, and deletes its node in the database
			 * */
			removeBuildingFromTreeView : function(ap_id){
				//Remove node from DB
				var remove_node_id = null;
				var i;
				for (i = 0; i < $rootScope.Nodes.nodes.length; i++){
					if ($rootScope.Nodes.nodes[i].access_point){
						if ($rootScope.Nodes.nodes[i].access_point_id == ap_id){
							remove_node_id = $rootScope.Nodes.nodes[i].id;
						}
					}
				}
				var data = {};
				data.id = remove_node_id;
				//Remove drom tree view
				$rootScope.Nodes.deleteNodeFromTree(remove_node_id);
				//Remove node from DB
				$rootScope.Nodes.deleteNode(data);
			},
			
			// BUILDING INTERIOR //
			
			/**
			 * Open Building method
			 * Is called when the building is clicked
			 * Opens a new modal, showing the interior of the building, with all the options in it.
			 * */
			openBuilding : function(building){
				//Open Modal
				var options = {
						autoOpen: false,
						modal: true,
						title:building.name,
						width: '1222',
						height:'600',
						dialogClass: "buildingInterior", 
						resizable:true,
						close: function(){
							self.buildingOpen = false;
							self.cablePaths = [];
						},
				};
				model = [];  
				self.buildingOpen = building;
				self.building_modal_width = 1222;

				//usado para colocar em readonly
				if(building.sharedDatabase){
					self.sharedDatabase = building.sharedDatabase;
				}else{
					self.sharedDatabase = "";
				}

				$rootScope.dialogService.open('buildingInterior','buildingInterior', model, options);				
				$rootScope.event = null;
				// Draw all cable svgs, after the window is loaded
				$timeout(function(){
					self.drawCableSvgs(building.cables);
				}, 100);				
				
				$(window).resize(function(){
					self.building_modal_width = $("#buildingInterior").width();
					self.drawCableSvgs(self.buildingOpen.cables);
				});
			},
			
			/**
			 * Get cable connections both ends method
			 * retrieves cable connections on both ends of a cable
			 * */
			getCableConnectionsBothEnds : function(cable){
				var connections_a = $rootScope.Connections.getAccessPointConnections(cable.building_conn_a_id);
				var connections_b = $rootScope.Connections.getAccessPointConnections(cable.building_conn_b_id);
				var all_connections = connections_a.concat(connections_b);
				var cable_connections = [];
				for(var i = 0; i < all_connections.length; i++){
					if (all_connections[i].cable_id == cable.id){
						cable_connections.push(all_connections[i]);
					}
				}
				return cable_connections;
			},
			
			/**
			 * Svg File To inline
			 * Replace all SVG images with inline SVG
			 */
			svgFileToInline : function(){
				$("img.svg").each(function(){
					var $img = jQuery(this);
					var imgID = $img.attr('id');
					var imgClass = $img.attr('class');
					var imgURL = $img.attr('src');

					jQuery.get(imgURL, function(data) {
						// Get the SVG tag, ignore the rest
						var $svg = jQuery(data).find('svg');

						// Add replaced image's ID to the new SVG
						if(typeof imgID !== 'undefined') {
							$svg = $svg.attr('id', imgID);
						}
						// Add replaced image's classes to the new SVG
						if(typeof imgClass !== 'undefined') {
							$svg = $svg.attr('class', imgClass+' replaced-svg');
						}

						// Remove any invalid XML tags as per http://validator.w3.org
						$svg = $svg.removeAttr('xmlns:a');

						// Replace image with new SVG
						$img.replaceWith($svg);

					}, 'xml');
				});
			},
			
			// CABLES  //
			
			/**
			 * Draw Cable SVGs method
			 * Generate all paths for the cables in the current building
			 * and stores them in the cablePaths array
			 * */
			drawCableSvgs : function(cables){
				self.cablePaths = [];
				self.client_y_values = [];
				self.ap_x_values = [];
				angular.forEach(cables, function(cable, idx){
					// Get connection A coordinates
					var conn_a_type = cable.building_conn_a_type;
					var conn_a_id = cable.building_conn_a_id;

					// Init vars to hold coordinates
					var conn_a_x, conn_a_y, conn_b_x, conn_b_y;
					var container_position = $( "#building-main-container" ).offset();
					if (conn_a_type == 1){
						// Access Point
						var ap_img = $( "#building_ap_" + conn_a_id );
						var position = ap_img.offset();
						if(!position){
							return;
						}
						conn_a_x = position.left - container_position.left;
						conn_a_y = position.top - container_position.top;
					} else {
						// Client
						var client_img = $( "#building_client_" + conn_a_id );
						var position = client_img.offset();
						if(!position){
							return;
						}
						conn_a_x = position.left - container_position.left;
						conn_a_y = position.top - container_position.top;
					}
					
					// Get connection B coordinates
					var conn_b_type = cable.building_conn_b_type;
					var conn_b_id = cable.building_conn_b_id;
					if (conn_b_type == 1){
						// Access Point
						var ap_img = $( "#building_ap_" + conn_b_id );
						var position = ap_img.offset();
						if(!position){
							return;
						}
						conn_b_x = position.left - container_position.left;
						conn_b_y = position.top - container_position.top;
					} else {
						// Client
						var client_img = $( "#building_client_" + conn_b_id );
						var position = client_img.offset();
						if(!position){
							return;
						}
						conn_b_x = position.left - container_position.left;
						conn_b_y = position.top - container_position.top;
					}
					
					// Determine the type of connection will be drawn
					if ((conn_a_type == conn_b_type) && (conn_a_type == 1)){
						// Connection between two access points
						coords_a = {
								x : conn_a_x + 25,
								y : conn_a_y + 10
						}
						coords_b = {
								x : conn_b_x + 25,
								y : conn_b_y + 10
						}
						self.drawPathBetweenAccessPoints(cable, coords_a, coords_b);
						
					} else if (conn_a_type != conn_b_type) {
						// Connection between client and access point
						var ap_coordinates, client_coordinates;
						if (conn_a_type == 1){
							ap_coordinates = {
									x : conn_a_x + 25,
									y : conn_a_y + 10
							}
							client_coordinates = {
									x : conn_b_x + 25,
									y : conn_b_y + 50
							}
						} else {
							client_coordinates = {
									x : conn_a_x + 25,
									y : conn_a_y + 50
							}
							ap_coordinates = {
									x : conn_b_x + 25,
									y : conn_b_y + 10
							}
						}
						
						self.drawPathClientAccessPoint(cable, client_coordinates, ap_coordinates);
					}
				});
			},
			
			/**
			 * Draw path between access points method
			 * Draws all necessary paths between two access points.
			 * */
			drawPathBetweenAccessPoints : function(cable, coords_a, coords_b){
				// Get color
				var path_color;
				angular.forEach($rootScope.Cables.cableTypes, function(el, index){
					angular.forEach(el,function(cableType, index){
						if(cableType.id == cable.cable_type_id){
      						path_color = cableType.color;                 
      					}
					});
				});				
				
				// 3 paths
				// path 1: from ap A, going to the right
				path1 = {};
				path1.x1 = coords_a.x;
				path1.y1 = coords_a.y;
				path1.x2 = self.getApX2(coords_a.x);
				path1.y2 = coords_a.y;
				path1.color = path_color;
				path1.cable_name = cable.name;
				path1.stroke_width = 6;
				path1.cable_id = cable.id;
				self.cablePaths.push(path1);
				
				// path 2: from path 1 end, to ap B, a bit to the right
				path2 = {};
				path2.x1 = path1.x2;
				path2.y1 = path1.y2;
				path2.x2 = path1.x2;
				path2.y2 = coords_b.y;
				path2.color = path_color;
				path2.cable_name = cable.name;
				path2.stroke_width = 6;
				path2.cable_id = cable.id;
				self.cablePaths.push(path2);
				
				// path 3: from path 2 end, to ap B
				path3 = {};
				path3.x1 = path2.x2;
				path3.y1 = path2.y2;
				path3.x2 = coords_b.x;
				path3.y2 = coords_b.y;
				path3.color = path_color;
				path3.cable_name = cable.name;
				path3.stroke_width = 6;
				path3.cable_id = cable.id;
				self.cablePaths.push(path3);
			},
			
			/**
			 * Draw Path client access point method
			 * Draws all necessary paths between a client and an access point.
			 * */
			drawPathClientAccessPoint : function(cable, client_coordinates, ap_coordinates){
				// 3 paths
				// path 1: from client, going down
				path1 = {};
				path1.x1 = client_coordinates.x;
				path1.y1 = client_coordinates.y;
				path1.x2 = client_coordinates.x;
				path1.y2 = self.getClientY2(client_coordinates.y);
				path1.color = "grey";
				path1.cable_name = cable.name;
				path1.stroke_width = 4;
				path1.cable_id = cable.id;
				self.cablePaths.push(path1);
				
				// path 2: to the hall
				path2 = {};
				path2.x1 = path1.x2;
				path2.y1 = path1.y2;
				path2.x2 = ap_coordinates.x + 100;
				path2.y2 = path1.y2;
				path2.color = "grey";
				path2.cable_name = cable.name;
				path2.stroke_width = 4;
				path2.cable_id = cable.id;
				self.cablePaths.push(path2);
				
				// path 3: hall to ap
				path3 = {};
				path3.x1 = path2.x2;
				path3.y1 = path2.y2;
				path3.x2 = ap_coordinates.x;
				path3.y2 = ap_coordinates.y;
				path3.color = "grey";
				path3.cable_name = cable.name;
				path3.stroke_width = 4;
				path3.cable_id = cable.id;
				self.cablePaths.push(path3);
			},
			
			/**
			 * Get Ap X 2
			 * Returns the x2 coordinate of the fist path in the ap-to-ap cable, 
			 * based on the amount of those paths drawn already;
			 * */
			getApX2 : function(coords_a_x){
				var x_value = coords_a_x + 20;
				while (self.ap_x_values.indexOf(x_value) != -1){
					x_value = x_value + 20;
				}
				self.ap_x_values.push(x_value);
				return x_value;
			},
			
			
			/**
			 * Get client y 2
			 * Returns the Y coordinate of the second point in the first path in a client-to-ap cable
			 * */
			getClientY2 : function(client_y){
				var y_value = client_y + 10;
				while (self.client_y_values.indexOf(y_value) != -1){
					y_value = y_value + 10;
				}
				self.client_y_values.push(y_value);
				return y_value;
			},
			
			/**
			 * Show cable name method
			 * When cable svg in building is hovered, show the name,
			 * and take the location of the name div based on the event object
			 * */
			showCableName : function(cable_name, event){
				var container_position = $( "#building-main-container" ).offset();
				var top_offset = event.pageY - container_position.top + 72;
				if (self.addingCable){
					top_offset = top_offset + $('#addCableBuildingForm').width() - 72;
				}
				$('#building_cable_name').css({'top':top_offset,'left':event.pageX - container_position.left - 12});
				self.current_cable_name = cable_name;
			},
			
			/**
			 * hide cable name method
			 * Hide cable name div, independently of where it is
			 * */
			hideCableName : function(){
				self.current_cable_name = false;
			},
			
			/**
			 * Add Cable method
			 * Opens a menu to add a cable between two access points, or an access point and the main building connection
			 * 
			 * */
			addCable : function(){
				if (self.addingCable){
					self.cancelAddBuilding();
					return;
				}
				
				// Get types
				$rootScope.Cables.compileManufacturers();
				$rootScope.Cables.compileFiberNumbers();
				$rootScope.Cables.cableTypesAddFiltered = $rootScope.Cables.cableTypesAdd.slice();
	        	//Prefilter it with the default filter, if there is one
	        	$timeout(function(){
		        	if ($rootScope.DefaultValues.cable_manufacturer){
		        		$rootScope.form.add_list_manufacturer = $rootScope.DefaultValues.cable_manufacturer.str_value;
		        		$rootScope.Cables.updateCableList();	        		
		        	}
	        	},100);
	        	
	        	// If another cable is being edited, cancel that action...
	        	if (self.editing){
            		self.editing = false;
	        	}
	        	
	        	// Set connecting access points to null
	        	self.connectingAccessPoints = [];
	        	
	        	// Set adding cable
	        	self.addingCable = true;
			},
			
			/**
			 * Add cable confirm method
			 * 
			 * Saves a new cable based on the form data, and the access points clicked
			 * */
			addCableConfirm : function(){
				// Validate if two access points have been added
				if (self.connectingAccessPoints.length < 2){
					return;
				}	
				
				$rootScope.form.building_id = self.buildingOpen.id;
				$rootScope.form.building_conn_a_type = 1;
				$rootScope.form.building_conn_a_id = self.connectingAccessPoints[0].id;
				$rootScope.form.building_conn_b_type = 1;
				$rootScope.form.building_conn_b_id = self.connectingAccessPoints[1].id;
				
				$rootScope.Cables.addCableInBuilding();
			},
			
			/**
			 * Cancel adding building method
			 * Cleans up all vars related to cable adding, and closes the form
			 * */
			cancelAddBuilding : function(){
				self.addingCable = false;
				self.connectingAccessPoints = [];
				$rootScope.form = [];
			},
			
			/**
			 * Add AP to add list method
			 * 
			 * Adds the given access point to the list of access points to connect with the cable.
			 * */
			addApToAddList : function(access_point){
				if (self.connectingAccessPoints.length >= 2){
					return;
				}
				if (self.connectingAccessPoints.indexOf(access_point) >= 0){
					return;
				}
				self.connectingAccessPoints.push(access_point);
			},
			
			/**
			 * Cable connected to method
			 * 
			 * */
			cableConnectedTo : function(cable, type, id){
				if (cable.building_conn_a_type == type){
					if (cable.building_conn_a_id == id){
						return true
					}	
				}
				if (cable.building_conn_b_type == type){
					if (cable.building_conn_b_id == id){
						return true
					}	
				}
				return false;
			},
			
			// ACCESS POINTS  //
			
			/**
			 * Add Access Point method
			 * Opens a Modal to add an access point to the building
			 * */
			addAccessPoint : function(){
				var options = {
						autoOpen: false,
						modal: true,
						title: $rootScope.Users.translateText("Adicionar Ponto de Acesso"),
						width: '300',
						height: 'auto',
						dialogClass: "addAccessPointBuilding", 
						resizable:true,
				};
				model = [];
				form = [];
				$rootScope.dialogService.open('addAccessPointBuilding','addAccessPointBuilding', model, options);
			},
			
			/**
			 * Add Access Point Confirm method
			 * Creates an access Point in the Floor specified in the form
			 * */
			addAccessPointConfirm : function(){
				// Add access point synchronously, and get the result
				result = $rootScope.AccessPoints.addConfirm(true);
				
				// Store the result in the floor it was added in
				for(var i = 0; i < self.buildingOpen.floors.length; i++){
					if (self.buildingOpen.floors[i].id == result.floor_id){
						if (!self.buildingOpen.floors[i].access_points){
							self.buildingOpen.floors[i].access_points = [];
						}
						self.buildingOpen.floors[i].access_points.push(result);
					}
				}

				$rootScope.AccessPoints.block_dbclick_add_ap = false;

				// Clear adding data
				self.cancelAddAccessPoint();
			},
			
			/**
			 * Cancel add access point
			 * */
			cancelAddAccessPoint : function(){
				// Close Modal
				$rootScope.dialogService.close('addAccessPointBuilding');
				
				// Clear form data
				$rootScope.form = [];
			},
			
			/**
			 * Open Access Point Method
			 * Is called on click on access point. Redirects according to circumstances
			 */
			 openAccessPoint : function(access_point){
				if (self.clientConnecting){
					$rootScope.Connections.connectClient(self.clientConnecting, access_point, true);
				} else if (self.addingCable) {
					self.addApToAddList(access_point);
				} else {
					$rootScope.Connections.openAccessPoint(access_point);
				}
			},
			
			/**
			 * Get access points method
			 * Returns an array with all the access points in a building
			 * */
			getAccessPoints : function(building){
				var access_points = [];
				angular.forEach(building.floors, function(floor, floor_idx){
					access_points = access_points.concat(floor.access_points);
				});
				return access_points;
			},
			
			/**
			 * Set Mergind Access Point
			 * 
			 * When merging a cable with a building, the users chooses 
			 * one access point to connect to the cable.
			 * */
			confirmMergeAccessPoint : function(access_point){
				// Close modal
				$rootScope.dialogService.close("mergeBuildingModal");
				
				var dataSend = {};
				// Access Point
				dataSend.access_point = {};
				dataSend.access_point.id = access_point.id;
				
				// Cable
				dataSend.cable = {};
				dataSend.cable.id = $rootScope.merge_building_cable.id;
				dataSend.cable.building_id = $rootScope.merge_building.id;
				dataSend.cable.building_conn_a_id = access_point.id;
				dataSend.cable.dot = {};
				dataSend.cable.dot.id = $rootScope.merge_building_dot.id;
				
				// Building
				dataSend.building = {};
				dataSend.building.id = $rootScope.merge_building.id;
				dataSend.building.dot = {};
				dataSend.building.dot.id = $rootScope.merge_building.dot.id;
				
				// Position
				dataSend.position = $rootScope.merge_building_position;
								
				$.ajax({
					url:  $rootScope.base_url+"/cables/merge_with_building_ap",
					type: "POST",
					data: dataSend,
					success: function(data){
						$rootScope.Cables.redrawCable(data.id);
					},
					complete: function(){

					}
				});
			},
			
			/**
			 * Merge Building Cancel
			 * 
			 * Cleanup the merging variables, and close modal
			 * */
			mergeBuildingCancel : function(){
				// Close modal
				$rootScope.dialogService.close('mergeBuildingModal');
				
				// Cleanup building access points
				$rootScope.merge_building_access_points = [];
				$rootScope.merge_building = [];
			},
			
			// CLIENTS //
		
			/**
			 * Add Client Building method
			 * Opens a modal for confirmation
			 * */
			addClientBuilding : function(apartment){
				// No action if client is already present
				if (apartment.client){
					return;
				}
				self.apartment_adding = apartment;
				
				// Initialize form data
				$rootScope.form = [];
				$rootScope.form.apartment_id = apartment.id;
				
				// Open Modal
				var options = {
						autoOpen: false,
						modal: true,
						title: $rootScope.Users.translateText("Adicionar Cliente"),
						width: '400',
						height: 'auto',
						dialogClass: "addClientBuilding", 
						resizable:true,
				};
				model = [];
				$rootScope.dialogService.open('addClientBuilding','addClientBuilding', model, options);
			},
			
			/**
			 * Add Client Building Confirm method
			 * Adds a client in the building, in the specified apartment
			 * */
			addClientBuildingConfirm : function(){
				self.isLoading = true;
				
				// Call the add client method synchronously, and get the result
				result = $rootScope.Clients.add(true);
				
				// Push returning entity to the apartment
				self.apartment_adding.client = result;
				
				// Stop loading
				self.isLoading = false;
				
				// Close Modal
				$rootScope.dialogService.close('addClientBuilding');
			},
			
			/**
			 * Set client connecting method
			 * Sets a client to a blinking state. If an access point is clicked after this is done,
			 * a drop cable should be added between the two.
			 * */
			setClientConnecting : function(client){
				if (self.clientConnecting){
					if (self.clientConnecting == client){
						client.connecting = false;
						self.clientConnecting = null;
					}
					return;
				}
				client.connecting = true;
				self.clientConnecting = client;
			},
			
			/**
			 * Delete Client method
			 * Delete a client from the building
			 * */
			deleteClient : function(client){
				if (client.ap_id_connected){
					return;
				}
				var options = {
						autoOpen: false,
						modal: true,
						title: $rootScope.Users.translateText('Atenção'),
						width: '400',
						height: 'auto',
						resizable: true,
						dialogClass: "noclose", 
						close:function(){}
				};
				model = [];
				$rootScope.deleteBuildingClientId = client.id;
				dialogService.open('buildingClientDelete', 'buildingClientDelete', model, options).then();
			},
			
			/**
			 * Delete Client Confirm method
			 * Confirms the deletion of a client in a building
			 * */
			deleteClientConfirm : function(client_id){				
				// Delete Client from Database
				self.deleting_client = true;
				$rootScope.Clients.deleteConfirm(client_id, true);
				self.deleting_client = false;
				
				// Delete client locally
				angular.forEach(self.buildings, function(building, idx){
					angular.forEach(building.floors, function(floor, floor_idx){
						angular.forEach(floor.apartments, function(apartment, ap_idx){
							if (apartment.client){
								if (apartment.client.id == client_id){
									apartment.client = null;
								}
							}
						});
					});
				});
			},

			deleteBuilding : function(){
				dialogService.close("menuBuilding");
				var options = {
						autoOpen: false,
						modal: true,
						title: $rootScope.Users.translateText('Atenção'),
						width: '400',
						height: 'auto',
						resizable: true,
						dialogClass: "noclose", 
						close:function(){}
				};
				model = [];
				$rootScope.deleteBuildingId = $rootScope.menuBuildingId;
				dialogService.open('buildingDelete', 'buildingDelete', model, options).then();
			},
			
			buildingEmpty : function(building_id){
				for (var k = 0; k < self.buildings.length; k++){
					if (self.buildings[k].id == building_id){
						for (var i = 0; i < self.buildings[k].floors.length; i++){
							if (self.buildings[k].floors[i].access_points && self.buildings[k].floors[i].access_points.length > 0){
								return false;
							}
							for(var j = 0; j < self.buildings[k].floors[i].apartments.length; j++){
								if (self.buildings[k].floors[i].apartments[j].client){
									return false;
								}
							}
						}
					}
				}
				return true;
			},

			deleteConfirm : function(building_id){
				// Check if building is empty at the moment
				if (!self.buildingEmpty(building_id)){
					error_data = {};
					error_data.errors = [];
					error_data.success = 0;
					error_data.message = $rootScope.Users.translateText("Prédio possui caixas e/ou clientes. Remova-os antes de remover o prédio.")
					$rootScope.set_errors_modal(error_data, 'buildingDelete', false);
					//TODO set error
					return;
				}

				data = {};
				data.id = building_id;
				
				$.ajax({
					url: $rootScope.base_url+'/buildings/delete',
					type: 'POST',
					data:data ,
					success:function(data){
						if(data.status == 0){
							$rootScope.set_message(data);
							return;
						}
						dialogService.close('buildingDelete');
						
						// Delete building from logal array, and remove the map marker
						angular.forEach(self.buildings,function(el,index){
							if(el.id == data.id){
								$rootScope.Markers.removeFromMap(el.marker);
								self.buildings.splice(index,1);   
								return;
							} 
						}); 
						// Remove the buildings from the treeview
						self.removeBuildingFromTreeView(data.id);
					},
				});
			},

			edit : function(id){
				model = []; 
				$rootScope.form = [];
				$rootScope.form.error = [];

				if(!self.bulkEdit){ 

					angular.forEach(self.buildings,function(el,index){
						if(el.id == id){
							$rootScope.form = el;
							$rootScope.selectedBuilding = el;
							return;
						} 
					});
				
				}else{
					$rootScope.Nodes.getTreeViewFolders();
				}
	
				var options = {
					autoOpen: false,
					modal: true,
					title: $rootScope.Users.translateText('Editar prédio'),
					width: 400,
					height:'auto',
					resizable:true,
					dialogClass: "noclose", 
					position: {
						my: "center",
						at: "center",
						of: window,
						collision: "none"
					},
					create: function (event, ui) {
						$(event.target).parent().css('position', 'fixed');
					},   
					close:function(){
						self.editing = false;   
						$rootScope.form = [];
						$rootScope.selectedBuilding = undefined;

						if(self.bulkEdit){
							self.bulkEdit = false;
							self.bulkDeploy = false;
							self.bulkUndeploy = false;
							$rootScope.dotsCount = $rootScope.dotsTemp.length;
						}
					}    
				};
				self.editing = true;
				if(dialogService.isOpen('menuBuilding')){
					dialogService.close('menuBuilding');
				} 
				dialogService.open('buildingAdd','buildingAdd', model, options).then(function() {
					setTimeout(function() {
						$("#select-folder-buildings").selectize();
					}, 1000);
				}); 
	
			},

			bulkEditConfirm : function(){

				self.isLoading = true;
				$rootScope.$evalAsync();

				var buildings = $rootScope.Buildings.buildings.filter(obj =>  obj.marker && google.maps.geometry.poly.containsLocation(obj.marker.position, $rootScope.shapeTemp));
	
				if(buildings.length === 0){
					$rootScope.message_error_modal = $rootScope.Users.translateText("Tipo não encontrado");
					self.isLoading = false;
					return;
				}

				var arrItems = {};
				var contIndex = 0;
	
				buildings.forEach(building =>{

					//verifica se o item está visivel
					if(!$rootScope.Markers.markerOnMap(building.marker)){
						return;
					}
	
					var item = {};
					$rootScope.form.error = [];
	
					if ($rootScope.form.name){
						item.name = $rootScope.form.name;
						building.name = $rootScope.form.name;
						edit = true;
					}

					if ($rootScope.form.color){
						item.color = $rootScope.form.color;
						building.color = $rootScope.form.color;
						edit = true;
					}
					
					item.changeDeployed = false;
                
					//deploys
					if(self.bulkUndeploy && building.deploy_information.deployed){
						item.changeDeployed = true;
						item.deployed = false;
						building.deploy_information.deployed = false;
					}else if(self.bulkDeploy && !building.deploy_information.deployed){
						item.changeDeployed = true;
						item.deployed = true;
						building.deploy_information.deployed = true;
					}

					item.changeFolder = false;

					if ($('#select-folder-buildings').val()){
						
						var node = [];
						
						if(node = $rootScope.Nodes.nodes.find(n=>n.building_id === building.id)){
							item.node_id = node.id;
							item.parent_id = parseInt($('#select-folder-buildings').val());
							item.changeFolder = true;
						}					
						
					}
					
					item.id = building.id;

					arrItems[contIndex] = item;
					contIndex++;
			
				});

				edit_many(arrItems);

				function edit_many(items) {
					self.isLoading = true;
					var dataSend = JSON.stringify(items);          
					$.ajax({
						url: $rootScope.base_url+'/buildings/edit_many',
						type: 'POST',
						data: {data:dataSend},
						dataType: "json",
						success:function(data){
							if(data.status == 1){

								$rootScope.message_success_modal = data.message;
								self.isLoading = false;
								location.reload(true);
							}              
						},
						error: function(data){
							$rootScope.message_error_modal = data.message;
							console.log(data);
							self.isLoading = false;
						},
						complete:function(){
							
							$rootScope.$digest();
						}
					});
				}
				
			},

			deploy : function(selectedBuilding,deploy){
				self.isLoading = true;
				$.ajax({
					url: $rootScope.base_url+'/buildings/deploy',
					type: 'POST',
					data: {id: selectedBuilding.id,deployed:deploy},
					success:function(response){            
						if(response.status == 0){
							$rootScope.alert_message('<h6>'+response.message+'</h6>');
						}else{
							for(var i = 0; i < self.buildings.length; i++){
								self.isLoading = true;
								if(self.buildings[i].id == selectedBuilding.id){
									$rootScope.buildingDeployed = deploy;
									if (self.buildings[i].deploy_information){
										self.buildings[i].deploy_information.deployed = deploy;
									}else{
										self.buildings[i].deploy_information = {};
										self.buildings[i].deploy_information.deployed = deploy;
									}
									
									if(deploy){
										self.buildings[i].marker.setIcon($rootScope.base_url+"/img/icons_map/predio_deployed.svg");
										self.buildings[i].marker.setDraggable(false);
									}else{
										self.buildings[i].marker.setIcon($rootScope.base_url+"/img/icons_map/predio.svg");
									}
	
								}
							};
						}            
					},
					complete:function(){
						self.isLoading = false;
						dialogService.close('menuBuilding');  
						$rootScope.$digest();
					}
				})
			},

			menuAccesspoint : function(accessPoint){

				var options = {
					autoOpen: false,
					modal: true,
					title: $rootScope.Users.translateText('Atenção'),
					width: 'auto',
					height:50,
					resizable:true,
					dialogClass: "noclose noheader",
					position: {
						my: "left top",
						at: "left+"+event.pageX+" top+"+event.pageY,
						of: window,
						collision: "none"
				},
				create: function (event, ui) {
						$(event.target).parent().css('position', 'fixed');
				},
				close:function(){
						$rootScope.menuAccessPoint = false;
				}
				};
				model = [];
				$rootScope.accessPointDeployed = accessPoint.deploy_information.deployed;
				$rootScope.accessPointId = accessPoint.id;
				$rootScope.accessPointCategory = accessPoint.category;
				$rootScope.menuAccessPoint = true;
				dialogService.open('menuAccessPoint','menuAccessPoint', model, options).then();

			},

			loadBuilding : function(accessPoint){

				angular.forEach($rootScope.AccessPoints.accessPointTypes,function(aptype,index){
					if(aptype.id == accessPoint.access_point_type_id){
						if(accessPoint.deploy_information.deployed){
							icon = aptype.icon.split('.');
							$("#building_ap_" + accessPoint.id)[0].src = $rootScope.base_url+"/img/icons_map/"+icon[0]+'_deployed.png';
						}else{
							$("#building_ap_" + accessPoint.id)[0].src = $rootScope.base_url+"/img/icons_map/"+aptype.icon;
						}
					}
				});

			},

			rename : function(id,new_name){

				var dataSend = {};
				dataSend.id = id;
				dataSend.name = new_name;
		
				link = $rootScope.base_url+"/buildings/edit";
					
				$.ajax({
						url: link,
						type: "POST",
						data: dataSend,
						success:function(data){
							for (var i = 0; i < $rootScope.Buildings.buildings.length; i++){
								if($rootScope.Buildings.buildings[i].id === id){
									$rootScope.Markers.removeFromMap($rootScope.Buildings.buildings[i].marker);
									$rootScope.Buildings.buildings[i].marker.title = new_name;
									$rootScope.Markers.addToMap($rootScope.Buildings.buildings[i].marker);
									$rootScope.$apply();
								}
							}
						}});
		
			},
			
			/**
			 * Remove Building From Treeview method
			 * Removes the treeview node of a building
			 * */
			removeBuildingFromTreeView : function(building_id){
				//Remove node from DB
				var remove_node_id = null;
				for (var i = 0; i < $rootScope.Nodes.nodes.length; i++){
					if ($rootScope.Nodes.nodes[i].building){
						if ($rootScope.Nodes.nodes[i].building_id == building_id){
							remove_node_id = $rootScope.Nodes.nodes[i].id;
						}
					}
				}
				var data = {};
				data.id = remove_node_id;
				//Remove drom tree view
				$rootScope.Nodes.deleteNodeFromTree(remove_node_id);
				//Remove node from DB
				$rootScope.Nodes.deleteNode(data);
			}
	}

	return self;

})