app.service('AccessPoints', function($rootScope,Map,Projects,dialogService,$q,Cables, $timeout,LevelsAndModes, ItemImages){
	
	var self = {
		isLoading : false,
		accessPoints : [],
		//accessPoints : [],
		editing : false,
		addOnCable : false,
		viewAllCircles : false,
		showClientsStatusDiv : false,
		aps_loaded_width : "0%",
		viewAllAccessPoints1 : 0,
		viewAllAccessPoints2 : 0,
		viewAllAccessPoints3 : 0,
		viewAllAccessPoints4 : 0,
		viewAllAccessPoints5 : 0,
		viewAllAccessPoints6 : 0,
		viewAllInfowindow : false,
		allCtoTypes: {},
		bulkEdit : false,
		bulkUndeploy : false,
        bulkDeploy : false,
        bulkCategory : 0,
        accessPointPercentageFree : [],
		
		/**
		 * Update Items Menu
		 * This will create an array called accessPointsItemMenu, where only the accessPoints of the currently selected projects will be added.
		 * The functionality is to make only items from current projects appear in the itemsMenu modal.
		 * */
		updateItemsMenu : function(){
			self.accessPointsItemMenu = [];
			angular.forEach(self.accessPoints, function(accessPoints, indexType){
				self.accessPointsItemMenu[indexType] = [];
				angular.forEach(accessPoints, function(accessPoint,indexAccessPoint){
					if (itemInArray(accessPoint.project, $rootScope.Projects.projectsChecked)){
						self.accessPointsItemMenu[indexType].push(accessPoint);
					}
				})
			})
		},
		
		getPercentageFreePorts : function(accessPoint){
			conns = $rootScope.Connections.getApConnectionsSync(accessPoint.id);
			var total_ports = 0;
			var available_ports = 0;
			angular.forEach(conns, function(conn, conn_idx){
				if (conn.splitter){
					total_ports = total_ports + conn.splitter.ports_number;
					var avail = conn.splitter.ports_number - (conn.fusions_in.length + conn.fusions_out.length);
					available_ports = available_ports + avail;
				}
			});
			if (total_ports == 0){
				return 100;
			}
			return ((available_ports/total_ports)*100);
		},

		/**
		 * 
		 * @returns {Promise} percentage free of all access points
		 */
		getAllPecentageFree : function(){
			var d = $q.defer();
            if (self.accessPointPercentageFree.length > 0){
                d.resolve(self.accessPointPercentageFree);
                return d.promise;
            }
			link = $rootScope.base_url+'/access_points/get_all_percentage_free';
			$.ajax({
				url: link,
				type: 'POST',
				success:function(response){
					self.accessPointPercentageFree = response;
                	d.resolve(response);
				},
				error:function(response){
					console.log("ERROR");
					console.log(response);
				}
			});
        	return d.promise;
		},
		
		toggleAllCircles : function(){
			if (self.viewAllCircles){
				angular.forEach(self.accessPoints[3],function(ap,indexAp){
					if (ap.circle){
						ap.circle.setMap(null);
						//$rootScope.Markers.removeFromMap(ap.circle);
					}
				});
			angular.forEach(self.accessPoints[5],function(ap,indexAp){
				if (ap.circle){
					ap.circle.setMap(null);
					//$rootScope.Markers.removeFromMap(ap.circle);
				}
			});
			angular.forEach(self.accessPoints[6],function(ap,indexAp){
				if (ap.circle){
					ap.circle.setMap(null);
					//$rootScope.Markers.removeFromMap(ap.circle);
				}
			});
			self.viewAllCircles = false;
			Map.viewAllCircles = false;
			} else {
				
				// set color and opacity of circles and show them
				self.getAllPecentageFree().then(function(){
					angular.forEach(self.accessPointPercentageFree,function(ap,indexAp){
						self.accessPoints.filter(a => a.filter(b => b.id === ap.id).forEach(access_point =>{
							
							access_point.percentage_free = ap.percentage_free;

							if(!access_point.circle) {
                                console.log("Returning because AP has no circle:", access_point);
                                return
                            };
							
							//generate color
							let r = 100;
							let g = Math.floor(access_point.percentage_free * 2);
							let b = 155 + access_point.percentage_free;
							//generate opacity
							let opacity = 0.7 - (access_point.percentage_free * 0.004);
							let color = Map.rgbToHex(r,g,b);
							
							access_point.circle.setOptions({
								fillColor:color,
								fillOpacity:opacity,
							});
							
							if (access_point.dot.getMap()){ //show circle only if dot is on map
								access_point.circle.setMap(Map.map);
							}
						}));
					});
				});
				self.viewAllCircles = true;
				Map.viewAllCircles = true;
			}
		},

		countAccessPointsOnMap : function(){
			var count = 0;
			angular.forEach(self.accessPoints, function(ap_type_list, index){
				angular.forEach(ap_type_list, function(current_ap, index_ap){
					// Se a caixa esta no mapa, adiciona no count
					if (current_ap.dot.map){
						count++;
					}
				});
			});
			console.log("CAIXAS:", count);
			return count;
		},
		
		toggleAllInfowindow : function(){
			if(self.viewAllInfowindow){
				// Esconder todas as infowindows
				angular.forEach(self.accessPoints, function(ap_type_list, index){
					angular.forEach(ap_type_list, function(current_ap, index_ap){
						// Se infowindow esta no mapa faz a infowindow desaparecer
						if (current_ap.dot.infowindow.map){
							current_ap.dot.infowindow.close();
						}
						
					});
				});
				self.viewAllInfowindow = false;
			}else{
				// Checar se são caixas demais no mapa
				if (self.countAccessPointsOnMap() > 200){
					// Aviso de erros
					var options = {
							autoOpen: false,
							modal: true,
							title: $rootScope.Users.translateText('Atenção'),
							width: 300,
							height:'auto',
							resizable:true,
							dialogClass: "noclose", 
					};
					$rootScope.messageAlert = '<h6>' + $rootScope.Users.translateText('Caixas demais no mapa para mostrar nomes de caixas') + '</h6>'
						+ '<p>' + $rootScope.Users.translateText('Mostrar os nomes de muitas caixas pode travar o seu browser') + '</p>'
						+ '<p>' + $rootScope.Users.translateText('Remova algumas caixas para mostrar os nomes das caixas') + '</p>'
						model = [];  
					$rootScope.dialogService.open('alertModal','alertModal', model, options).then();
					return;
				}
				
				// Mostrar todas as infowindows
				angular.forEach(self.accessPoints, function(ap_type_list, index){
					angular.forEach(ap_type_list, function(current_ap, index_ap){
						// Se a caixa esta no mapa, faz a infowindow aparecer
						if (current_ap.dot.map){
							current_ap.dot.infowindow.open(Map.map, current_ap.dot);
						}
						
					});
				});
				self.viewAllInfowindow = true;
			}
		},

		refreshAccessPoint : function(id){
			angular.forEach(self.accessPoints,function(accessPoints,indexCategory){
				angular.forEach(accessPoints,function(ap,indexAp){
					if (ap.id == id){
						//Remove drawing from map (very necessary!)
						if (ap.circle){
							ap.circle.setMap(null);
							//$rootScope.Markers.removeFromMap(ap.circle);
						}
						//ap.dot.setMap(null);						
						$rootScope.Markers.removeFromMap(ap.dot);
						$rootScope.Markers.removeFromMap(ap.dot);
						ap = {};
						$.ajax({
							url:  $rootScope.base_url+'/access_points/get',
			      			type: 'POST',
			      			data: {id:id},
			      			success:function(data){
			      				if(data.id){
			      					accessPoint = [];
									accessPoint.dot = [];
									accessPoint.id = data.id;                
									accessPoint.name = data.name;            
									accessPoint.cost = data.cost; 
									accessPoint.category = data.category;
									accessPoint.access_point_type_id = data.access_point_type_id;
									accessPoint.color = data.color;
									//Get type info
									angular.forEach(self.accessPointTypes,function(el, index){
										if(el.id == accessPoint.access_point_type_id){
											type = el;
										}
									});
									//------------
									accessPoint.access_point_type_name = type.name;
									accessPoint.current_type_price = type.price;
									accessPoint.deploy_information = data.deploy_information;
									accessPoint.pon = type.pon;
									
									if(data.network_information){
										accessPoint.network_information = data.network_information; 
									}
									
									if(data.dot){
										if (accessPoint.deploy_information.deployed){
											icon = type.icon.split('.');
											icon = icon[0] + '_deployed.png';
										} else {
											icon = type.icon;
										}
										dot = Map.drawSVGMarker(data.dot.lat, data.dot.lng, type.icon.split('.')[0], data.name,
					 					"", data.deploy_information.deployed, self.getApColor(data), "black");
										dot.id = data.dot_id;
										dot.accessPointId = data.id;
										if((LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_TECNICO]) || 
                LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR])) && ((!accessPoint.deploy_information.deployed) || (accessPoint.id == $rootScope.AccessPoints.moving_id))) {
											dot.setDraggable(true);
										} else {
											dot.setDraggable(false);
										}

										dot.infowindow = Map.drawAccessPointNameInfowindow(accessPoint.name); 
										
										//dot.setMap(Map.map);
										$rootScope.Markers.addToMap(dot);
									}                 
									accessPoint.dot = dot;               
									Map.addListenerAccessPoint(accessPoint);
									if (indexCategory == 3){
										accessPoint.circle = Map.drawCircle(data.dot.lat,data.dot.lng,100, accessPoint);
										if (self.viewAllCircles){
											accessPoint.circle.setMap(Map.map);
											//$rootScope.Markers.addToMap(accessPoint.circle);
										}
					} else if (indexCategory == 5){
						accessPoint.circle = Map.drawCircle(data.dot.lat,data.dot.lng,type.radius, accessPoint);
						if (self.viewAllCircles){
							accessPoint.circle.setMap(Map.map);
							//$rootScope.Markers.addToMap(accessPoint.circle);
						}
					} else if (indexCategory == 6){
						accessPoint.circle = Map.drawCircle(data.dot.lat,data.dot.lng,type.radius, accessPoint);
						if (self.viewAllCircles){
							accessPoint.circle.setMap(Map.map);
							//$rootScope.Markers.addToMap(accessPoint.circle);
						}
					}
					
					self.accessPoints[indexCategory][indexAp] = accessPoint;
									$rootScope.$apply();
			      				}
			      			}
						})
					}
				})
			})
		},
		
		deploy : function(id,category,deploy){
			self.isLoading = true;
			$.ajax({
				url: $rootScope.base_url+'/access_points/deploy',
				type: 'POST',
				data: {id:id,deployed:deploy},
				success:function(data){            
					if(data.status == 0){
						$rootScope.alert_message('<h6>'+data.message+'</h6>');
					}else{

						if($rootScope.Buildings.buildingOpen){
							for (var i = 0; i < $rootScope.Buildings.buildingOpen.floors.length; i++){
								//if ($rootScope.Buildings.buildingOpen.floors[i].access_points){
								for (var j = 0; j < $rootScope.Buildings.buildingOpen.floors[i].access_points.length; j++){
									if($rootScope.Buildings.buildingOpen.floors[i].access_points[j].id == id){
										angular.forEach(self.accessPointTypes,function(aptype,index){
											if(aptype.id == $rootScope.Buildings.buildingOpen.floors[i].access_points[j].access_point_type_id){
												$rootScope.Buildings.buildingOpen.floors[i].access_points[j].deploy_information.deployed = deploy;

												if(deploy){
													icon = aptype.icon.split('.');
													$("#building_ap_" + id)[0].src = $rootScope.base_url+"/img/icons_map/"+icon[0]+'_deployed.svg';
												}else{
													$("#building_ap_" + id)[0].src = $rootScope.base_url+"/img/icons_map/"+aptype.icon;
												}
											}
										});
								}}
							}
						}else{

							self.refreshAccessPoint(id);

						}
					}            
				},
				complete:function(){
					self.isLoading = false;
					if(dialogService.isOpen('menuAccessPoint')){
						dialogService.close('menuAccessPoint'); 
					} 
					$rootScope.$digest();
				}
			})
		},

		move : function(id,category){
			if (self.moving_deployed_ap){
				return;
			}
			self.moving_deployed_ap = true;
			
	        angular.forEach(self.accessPoints[category],function(el,index){
	        	if(el.id == id){
	        		el.dot.setDraggable(true);
	    	        el.dot.setAnimation(google.maps.Animation.BOUNCE);
	        		self.moving_id = id;
	        		self.moving_category = category;
	        	} 
	        });
	        
	        //Open Little Box on corner
	        var options = {
	        		autoOpen: false,
	        		title: "Mover",
	        		width: 300,
	        		height:'auto',
	        		resizable:true,
	        		dialogClass: "noclose", 
	        		position: {
	        			my: "right top",
	        			at: "right-10 top+80",
	        			of: window,
	        			collision: "none"
	        		},
	        		create: function (event, ui) {
	        			$(event.target).parent().css('position', 'fixed');
	        		},   
	        		close:function(){
	        			self.moving_deployed_ap = false;
	        		}    
	        	};
	        if($rootScope.menuAccessPoint){
	        	dialogService.close('menuAccessPoint');  
	        }        
	        dialogService.open('moveDeployedAccessPoint','moveDeployedAccessPoint', model, options).then();
		},
		
		stop_move : function(){
			
	        angular.forEach(self.accessPoints[self.moving_category],function(el,index){
	        	if(el.id == self.moving_id){
	        		el.dot.setDraggable(false);
	        		el.dot.setAnimation(null);
	        	} 
	        });
	        
	        self.moving_deployed_ap = false;
	        self.moving_id = null;
	        self.moving_category = null;
	        dialogService.close('moveDeployedAccessPoint');  
		},
		
		edit : function(id,category){
			model = []; 
			$rootScope.form = [];
			$rootScope.form.error = [];

			switch(category){
				case 1:
					title = $rootScope.Users.translateText('Editar fonte');
				break;
				case 2:
					title = $rootScope.Users.translateText('Editar armário');
				break;
				case 3:
					title = $rootScope.Users.translateText('Editar PAC');
				break;
				case 4:
					title = $rootScope.Users.translateText('Editar caixa de emendas');
				break;
				case 5:
					title = $rootScope.Users.translateText('Editar caixa de atendimento');
				break;
				case 6:
					title = $rootScope.Users.translateText('Editar camera');
				break;
				default:
				break;
			} 

			if(!self.bulkEdit){       

				if($rootScope.Buildings.buildingOpen){
					angular.forEach($rootScope.Buildings.buildingOpen.floors, function(floor, floor_idx){
						if (floor.access_points && (floor.access_points.length > 0)){
							angular.forEach(floor.access_points, function(access_point, ap_idx){
								if (access_point.id == id){
									$rootScope.form = access_point;
								}
							});
						}
					});
				}else{

					//encontrar o access point dentro dos vetores
					angular.forEach(self.accessPoints[category],function(el,index){
						if(el.id == id){
							$rootScope.form = el;
							if(el.color){
								$rootScope.APcolor = el.color;
							}else{
								$rootScope.APcolor = "";
							}
							$rootScope.form.color = self.getApColor(el);
							if(el.network_information){
								$rootScope.form['ipv4'] = el.network_information.ipv4;
								$rootScope.form['ipv6'] = el.network_information.ipv6;
								$rootScope.form['mac_address'] = el.network_information.mac_address;
								$rootScope.form.network_information.id = el.network_information.id;
							}
							$rootScope.form['lat'] = el.dot.position.lat();
							$rootScope.form['lng'] = el.dot.position.lng();
							return;
						} 
					});  

				}
			}else{
			
				self.bulkCategory = category;
				$rootScope.Nodes.getTreeViewFolders();
				
			}

        	var options = {
        		autoOpen: false,
        		modal: true,
        		title: title,
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

        			if(self.bulkEdit){
						self.bulkEdit = false;
                        self.bulkDeploy = false;
						self.bulkUndeploy = false;
                        $rootScope.dotsCount = $rootScope.dotsTemp.length;
					}

        		}    
        	};
        	self.editing = true;
			if(dialogService.isOpen('menuAccessPoint')){
				dialogService.close('menuAccessPoint'); 
			}       
        	dialogService.open('accessPointAdd','accessPointAdd', model, options).then(function() {
				setTimeout(function() {
					$("#select-folder-aps").selectize();
				}, 1000);
            }); 

	    },

        showImages : function(accessPointId){
            ItemImages.showImages("access_point", accessPointId);
        },

		delete : function(id,category){
			
			

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
				$rootScope.accessPointid = id;                    
				$rootScope.accessPointCategory= category;
				dialogService.open('accessPointDelete','accessPointDelete', model, options).then();

			
		},



		deleteConfirm : function(id, category, synchronous){

			if($rootScope.Buildings.buildingOpen){

				//GET THE CONNECTIONS
				var ap_connections = null;
				link = $rootScope.base_url+'/access_points/get_connections_no_report';
				$.ajax({
					url: link,
					type: 'POST',
					async: false,
					data: {id:id},
                    headers: {
                        'X-CSRF-Token': $rootScope.getCookie('csrfToken')
                    },
					success:function(connections){
						ap_connections = connections;
					}
				});
				for (var i = 0; i < ap_connections.length; i++){
					if (!ap_connections[i].splitter_id){
						// This is a connection to a cable or client. Can't delete the access point
						// before deleting the connections inside of it.
						error_data = {};
						error_data.errors = [];
						error_data.success = 0;
						error_data.message = $rootScope.Users.translateText("Ponto de acesso possui conexoes com cabos ou clientes. Remova-as antes de remover o ponto de acesso.")
						$rootScope.set_errors_modal(error_data, 'accessPointDelete', false);
						return false;
					}
				}
				
				// Validations done, now delete the access point
				// Delete access point in database
				$rootScope.Buildings.deleting_access_point = true;

			}

			self.isLoading = true;
			var async = true;
			var set_errors = true;
			if (synchronous){
				//async = false;
				set_errors = false;
			}
			if (synchronous && $rootScope.Buildings.deleting_access_point){
				async = false;
			}

			link = $rootScope.base_url+'/accessPoints/delete';
			$.ajax({
				url: link,
				type: 'POST',
				data: {id:id},
				async: async,
				success:function(data){
					if (set_errors){
						$rootScope.set_errors_modal(data,'accessPointDelete');
					}
					if(data.status == 1){
						//Remove the access point from the map, and from the list of existing aps.
						angular.forEach(self.accessPoints[category],function(el,index){
							if(el.id == id){
								//el.dot.setMap(null);
								$rootScope.Markers.removeFromMap(el.dot);
								//If it has a range circle, unset it too
								if (el.circle){
									el.circle.setMap(null);
									//$rootScope.Markers.removeFromMap(el.circle);
								}
								self.accessPoints[category].splice(index,1);
								if($rootScope.menuAccessPoint){
									$rootScope.dialogService.close('menuAccessPoint');  
								}     
								return;
							} 
						}); 
						//Remove the AP from the treeview
						if (!$rootScope.Buildings.deleting_access_point){
							self.removeApFromTreeView(id);
						}else{
							$rootScope.Buildings.deleting_access_point = false;
				
							// Delete locally
							angular.forEach($rootScope.Buildings.buildings, function(building, idx){
								angular.forEach(building.floors, function(floor, floor_idx){
									if (floor.access_points && (floor.access_points.length > 0)){
										angular.forEach(floor.access_points, function(access_point, ap_idx){
											if (access_point.id == id){
												floor.access_points.splice(ap_idx);
												$rootScope.Markers.isLoading = false;
											}
										});
									}
								});
							});
						}
					}
				},
				complete:function(){
					self.isLoading = false;
					$rootScope.$digest();
				}
			})  
		},

		/**
		 * Delete all connections in an Access Point
		 * @param integer access_point_id
		 * */
		deleteAPConnections : function(access_point_id){
			//Delete all fusions in AP
			$rootScope.Fusions.resetFusionsAP(access_point_id);
			//Delete all connections
			var connections = $rootScope.Connections.getApConnectionsSync(access_point_id);
			angular.forEach(connections, function(conn, idx){
				if (conn.client_id){
					//Delete client connection, taking appropriate actions after the deletion
					$rootScope.Connections.removeClientConnectionConfirm(conn);
				} else {
					//Delete generic type of connection
					$rootScope.Connections.removeSingleConnection(conn.id);
				}
			});
		},
		
		addApTreeView : function(id, icon, name, tomo_index, tomo_type_index){
			node_data = {};
			node_data.parent_id = $rootScope.Nodes.saving_node_id;
			node_data.leaf = 1;
			node_data.selected = 1;
			node_data.checked = 1;
			node_data.category = 2;
			node_data.access_point_id = id;
			var tomo_node_id = $rootScope.Nodes.addSync(node_data);
			
			//Set tje icom
			icon = icon.split('.');
			icon = $rootScope.base_url + '/img/icons_map/' + icon[0] + '_deployed.svg';
			$rootScope.Nodes.addNoteToTree(id, tomo_node_id, $rootScope.Nodes.saving_node_id, icon, name, 2, tomo_index, tomo_type_index);
		},
		
		removeApFromTreeView : function(ap_id){
			//Remove node from DB
			var remove_node_id = null;
			var i;
			for (i = 0; i < $rootScope.Nodes.nodes.length; i++){
				if ($rootScope.Nodes.nodes[i].access_point){
					if ($rootScope.Nodes.nodes[i].access_point_id == ap_id){
						remove_node_id = $rootScope.Nodes.nodes[i].id;
					}
				}else if($rootScope.Nodes.nodes[i].data){
					if ($rootScope.Nodes.nodes[i].data.access_point_id == ap_id){
						remove_node_id = $rootScope.Nodes.nodes[i].data.id;
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
		
		focus : function(category, index){
			//self.accessPointsItemMenu[category][index].dot.setMap(Map.map);
			var marker = self.accessPointsItemMenu[category][index].dot;
			$rootScope.Markers.addToMap(marker);
			self.accessPointsItemMenu[category][index].statusView = 1;
			Map.setCenter(self.accessPointsItemMenu[category][index].dot.getPosition().lat(),self.accessPointsItemMenu[category][index].dot.getPosition().lng(),19);
		},
		
//		view : function(index,category){
//			if(self.accessPointsItemMenu[category][index].dot.getMap()){
//				self.accessPointsItemMenu[category][index].dot.setMap(null);
//				self.accessPointsItemMenu[category][index].statusView = 0;
//				//Set range circle to null too!
//				if (self.accessPointsItemMenu[category][index].circle){
//					self.accessPointsItemMenu[category][index].circle.setMap(null);
//				}
//			}else{
//				self.accessPointsItemMenu[category][index].dot.setMap(Map.map);
//				self.accessPointsItemMenu[category][index].statusView = 1;
//				Map.setCenter(self.accessPointsItemMenu[category][index].dot.getPosition().lat(),self.accessPointsItemMenu[category][index].dot.getPosition().lng(),19);
//				//Set range circle if necessary!
//				if ((self.accessPointsItemMenu[category][index].circle) && (Map.viewAllCircles)){
//					self.accessPointsItemMenu[category][index].circle.setMap(Map.map);
//				}
//			}
//		},


		typeList : function(listAccessPoints){
			self.isLoading = true;
			link = $rootScope.base_url+'/access_point_types/list_all'
			$.ajax({
				url: link,
				type: 'POST',
				success:function(data){           
					self.accessPointTypes = data;
					self.allCtoTypes = data.filter(function(type){return type.category === 5;});
                    self.saveTypeList(data);
					if(listAccessPoints){
						self.list();
					}
				},
				complete:function(){
					if (!listAccessPoints){
						self.isLoading = false;
					}
					$rootScope.$digest();
				}
			}) 
		},
		
		saveTypeList : function(types){
			self.accessPointTypesFixed = [];
			angular.forEach(types, function(type, idx){
				if (!self.accessPointTypesFixed[type.category]){
					self.accessPointTypesFixed[type.category] = [];
				}
				self.accessPointTypesFixed[type.category].push(type);
			});
		},


		list : function(){
			self.isLoading = true;
			self.accessPoints[1] = [];
			self.accessPoints[2] = [];
			self.accessPoints[3] = [];
			self.accessPoints[4] = [];
			self.accessPoints[5] = [];
			self.accessPoints[6] = [];
			link = $rootScope.base_url+'/access_points/list_all'
			$.ajax({
				url: link,
				type: 'POST',
				success:function(response){
					self.aps_loaded_width = response.percentage + "%";
                	$rootScope.$apply();
					
					self.organize_access_point_data(response.data);
					if (response.all_data_loaded){
						self.isLoading = false;
						//After listing all, notify treeview nodes service
						$rootScope.Nodes.everythingLoaded("accessPoints");
					} else {
						//There was too much data to get in one request, so start incremental load now.
                		self.list_incrementally(response.offset);
					}
				},
				complete:function(){
				}
			});
		},

		get : function(id){
			let access_point = null;
			$.ajax({
				url:  $rootScope.base_url+"/access_points/get",
				  type: "POST",
				  data: {id:id},
				  async: false,
				  success:function(data){
					  console.log("Got AP:", data);
						access_point = data;
				  }
			});
			return access_point;
		},
		
		list_incrementally : function(offset){
			link = $rootScope.base_url+'/access_points/list_all'
			$.ajax({
				url: link,
				data: {offset : offset},
				type: 'POST',
				success:function(response){
					self.aps_loaded_width = response.percentage + "%";
                	$rootScope.$apply();
                	
					self.organize_access_point_data(response.data);
					if (response.all_data_loaded){
						self.isLoading = false;
						//After listing all, notify treeview nodes service
						$rootScope.Nodes.everythingLoaded("accessPoints");

                        // @bruno - 10/01/2021 - Desabling server cache for now
						// Send an extra request to cache all the access points
						// cache_link = $rootScope.base_url+'/access_points/cache_all'
						// $.ajax({
						// 	url: cache_link,
						// 	type: 'POST',
						// 	success:function(response){}
						// });
					} else {
						//There was too much data to get in one request, so start incremental load now.
                		self.list_incrementally(response.offset);
					}
				},
				complete:function(){
				}
			});
		},

		organize_access_point_data : function(data){
			angular.forEach(data,function(el,index){
                if (el.floor_id > 0){
                	// If access point belongs to a building floor, dont list it.
                	// It will be separatelly loaded by the building
                    return;
                }
				angular.forEach(self.accessPointTypes,function(aptype,index){
					if(aptype.id == el.access_point_type_id){
						type = aptype;
						return;
					}
				});
				
				accessPoint = [];
				accessPoint.dot = [];
				accessPoint.id = el.id;                
				accessPoint.name = el.name;            
				accessPoint.cost = el.cost; 
				accessPoint.access_point_type_name = type.name;
				accessPoint.current_type_price = type.price;
				accessPoint.pon = type.pon;
				accessPoint.category = el.category;
				accessPoint.access_point_type_id = el.access_point_type_id; 
				accessPoint.color = el.color; 
				accessPoint.deploy_information = el.deploy_information;
				//usado pra pegar as fusões caso seja ap de pasta compartilhada
				if(el.sharedDatabase){
					accessPoint.sharedDatabase = el.sharedDatabase;
					accessPoint.real_id = el.real_id;
					accessPoint.hosts = el.hosts;
				}
				if(el.network_information){
					accessPoint.network_information = el.network_information; 
				}
				if (el.percentage_free){
					accessPoint.percentage_free = el.percentage_free;
				}
				accessPoint.erp_integrated_flag = el.erp_integrated_flag; 
				accessPoint.erp_id = el.erp_id;
				if(el.dot){

					dot = Map.drawSVGMarker(el.dot.lat, el.dot.lng, type.icon.split('.')[0], el.name,
					 "", el.deploy_information.deployed, self.getApColor(el), "black");					

					dot.infowindow = Map.drawAccessPointNameInfowindow(accessPoint.name);
					Map.addListenerAccessPoint(accessPoint);	
				}
				//dot.setMap(null);
				//$rootScope.Markers.removeFromMap(dot);
				dot.id = el.dot_id;
				dot.accessPointId = el.id;
				if ((LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_TECNICO]) || 
                LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR])) && ((!accessPoint.deploy_information.deployed) || (accessPoint.id == $rootScope.AccessPoints.moving_id))) {
					dot.setDraggable(true);
				} else {
					dot.setDraggable(false);
				}

				if(el.sharedDatabase){
					dot.setDraggable(false);
				}

				accessPoint.dot = dot;
				Map.addListenerAccessPoint(accessPoint);               
				// console.log("Switch to push: ", el.category);
				switch(el.category){
				case 1:
					//fontes
					self.accessPoints[1].push(accessPoint); 
					break;
				case 2:
					//armário
					self.accessPoints[2].push(accessPoint); 
					break;
				case 3:
					//pacs
					//adicionar area de atendimento
					if (el.dot){
						accessPoint.circle = Map.drawCircle(el.dot.lat,el.dot.lng,100, accessPoint);
					}
					self.accessPoints[3].push(accessPoint); 
					break;
				case 4:
					//caixas de emenda
					self.accessPoints[4].push(accessPoint); 
					break;
				case 5:
					//caixas de atendimento
					//adicionar area de atendimento
					if (el.dot){
						accessPoint.circle = Map.drawCircle(el.dot.lat,el.dot.lng,type.radius, accessPoint);
					}
					self.accessPoints[5].push(accessPoint); 
					break;
				case 6:
					//cameras
					//adicionar area de atendimento
					if (el.dot){
						accessPoint.circle = Map.drawCircle(el.dot.lat,el.dot.lng,type.radius, accessPoint);
					}
					self.accessPoints[6].push(accessPoint); 
					break;
				default:
					//se nao tiver category entao nao vai colocar em lugar nenhum pra nao dar pau no funcionamento
					console.log("ERROR - NO CATEGORY FOUND FOR: ", el.category, typeof el.category);
					break;
				}
            });
		},

		/**
		 * 
		 * @param {*} ap 
		 */
		getApColor: function (ap) {
			// If no color is set, set default grey
			if(!ap.color){
				ap.color = "#c0c0c0"; //gray
				return ap.color;
			}
			if(ap.color.indexOf("#") === -1){
				switch (ap.color) { //antes usava numeros pra definir as cores
					case "2":
						ap.color = "#ff0000"; //red
						break;
					case "3":
						ap.color = "#7fff00"; //green
						break;
					case "4":
						ap.color = "#0000ff"; //blue
						break;
					case "5":
						ap.color = "#ffff00"; //yellow
						break;
					case "6":
						ap.color = "#631b76"; //purple
						break;
					case "7":
						ap.color = "#FFFFFF"; //branca
						break;
					case "8":
						ap.color = "#d34e24"; //marrom
						break;
					case "9":
						ap.color = "#ff4d94"; //rosa
						break;
					case "10":
						ap.color = "#ffa64d"; //laranja
						break;
					case "11":
						ap.color = "#66ffff"; //azul clara
						break;
					default:
						ap.color = "#c0c0c0"; //gray
						break;
				}
			}
			return ap.color;
		},

		bulkEditConfirm : function(){

			self.isLoading = true;
			$rootScope.$evalAsync();

			var aps = $rootScope.AccessPoints.accessPoints[self.bulkCategory].filter(obj =>  obj.dot && google.maps.geometry.poly.containsLocation(obj.dot.position, $rootScope.shapeTemp));
            
            if(aps.length === 0){
            	$rootScope.message_error_modal = $rootScope.Users.translateText("Tipo não encontrado");
				self.isLoading = false;
				return;
			}
			
			var arrItems = {};
			var contIndex = 0;

			aps.forEach(ap =>{

				//verifica se o item está visivel
				if(!$rootScope.Markers.markerOnMap(ap.dot)){
					return;
				}

				var item = {};
				$rootScope.form.error = [];

				if ($rootScope.form.name){
				    item.name = $rootScope.form.name;
				    ap.name = $rootScope.form.name;
				}
				if ($rootScope.form.color){  
				    item.color = $rootScope.form.color;
				    ap.color = $rootScope.form.color;
				}
                
                item.changeDeployed = false;
                
                //deploys
                if(self.bulkUndeploy && ap.deploy_information.deployed){
                	item.changeDeployed = true;
                    item.deployed = false;
					ap.deploy_information.deployed = false;
				}else if(self.bulkDeploy && !ap.deploy_information.deployed){
					item.changeDeployed = true;
                    item.deployed = true;
					ap.deploy_information.deployed = true;
                }

				item.changeFolder = false;

				if ($('#select-folder-aps').val()){
					
					var node = [];
					
					if(node = $rootScope.Nodes.nodes.find(n=>n.access_point_id === ap.id)){
						item.node_id = node.id;
						item.parent_id = parseInt($('#select-folder-aps').val());
	                    item.changeFolder = true;
					}					
                    
                }
                
                item.id = ap.id;

				arrItems[contIndex] = item;
				contIndex++;
        
            });

            edit_many(arrItems);

            function edit_many(items) {
				self.isLoading = true;
				var dataSend = JSON.stringify(items);          
				$.ajax({
					url: $rootScope.base_url+'/access_points/edit_many',
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
		
		/**
		 * addConfirm
		 * 
		 * This is called from the menu "accessPointAdd", on confirm.
		 * Sends the request to the backend to add the new access point.
		 * 
		 * @param {boolean} add_synchronously 
		 */
		addConfirm : function(add_synchronously){
			// Prevent double click with flag flag
			if (!Map.KmzKmlImporting && !Map.serialAdding){				
				if (self.block_dbclick_add_ap){
					return;
				}
				self.block_dbclick_add_ap = true;
			}
			self.isLoading = true;
			created_entity = null;

			// Creating object with the request data
			var dataSend = {};
			dataSend.dot = {};
			dataSend.access_point_type = {};
			$rootScope.form.error = [];
			dataSend.name = $rootScope.form.name;   
			dataSend.color = $rootScope.form.color;      

			if(!self.editing){
				dataSend.access_point_type_id = $rootScope.form.access_point_type_id;


				if(Cables.positionOnCable && Cables.cableSelected){
					self.addOnCable = true;
					dataSend.cable = {};

					dataSend.cable = Cables.cableSelected.id;
					dataSend.dot.lat = Cables.positionOnCable.event.latLng.lat();
					dataSend.dot.lng = Cables.positionOnCable.event.latLng.lng(); 	

					if(Cables.positionOnCable.positioning == 'begin'){
						dataSend.dot.id = Cables.positionOnCable.dot_id;
						dataSend.next_dot = Cables.positionOnCable.next_dot;
						dataSend.position = 1;
					}
					if(Cables.positionOnCable.positioning == 'end'){
						dataSend.prev_dot = {};
						dataSend.dot.id = Cables.positionOnCable.dot_id;
						//when the var "positionOnCable" is populated, and the position is 'end', the var to describe the previous dot is called prev_dot
						dataSend.prev_dot = Cables.positionOnCable.prev_dot;
						dataSend.position = 3;
					}

					if(Cables.positionOnCable.positioning == 'middle'){
						//when the var "positionOnCable" is populated, and the position is 'middle', the var to describe the previous dot is called prevDot
						dataSend.prev_dot = Cables.positionOnCable.prevDot.id;
						dataSend.position = 2;
					}

					Cables.positionOnCable = false;
					Cables.usingPositionOnCable = false;
				}else{
					self.addOnCable = false;
					if (Map.serialAdding || Map.KmzKmlImporting){
						dataSend.dot.lat = $rootScope.current_position.lat;
						dataSend.dot.lng = $rootScope.current_position.lng; 	
					} else {
						if ($rootScope.event){
							dataSend.dot.lat = $rootScope.event.latLng.lat();
							dataSend.dot.lng = $rootScope.event.latLng.lng();
						}
					}

					// Check if floor id is present
					if ($rootScope.form.floor_id){
						dataSend.floor_id = $rootScope.form.floor_id;
					}
				}

				Cables.usingPositionOnCable = false;
				//pegar dados do type
				angular.forEach(self.accessPointTypes,function(el, index){
					if(el.id == $rootScope.form.access_point_type_id){
						type = el;
						dataSend.cost = el.price;
						return;
					}
				});
			}else{
				dataSend.id = $rootScope.form.id;
				dataSend.editAddress = false; // para executar a função ctoEditAddress do Synsuite
				dataSend.dot.lat = $rootScope.form.lat;
				dataSend.dot.lng = $rootScope.form.lng;
			}

			// 
			if($rootScope.accessPointCategory == 3){
				dataSend.network_information = {};
				dataSend.network_information.ipv4 = $rootScope.form.ipv4;
				dataSend.network_information.ipv6 = $rootScope.form.ipv6;
				dataSend.network_information.mac_address = $rootScope.form.mac_address;
				if(self.editing && $rootScope.form.network_information){
					dataSend.network_information.id = $rootScope.form.network_information.id;
				}
			}

			// Defining Request URL depending on action
			if(self.editing){
				link = $rootScope.base_url+'/access_points/edit'
			}else{
				if(self.addOnCable){
					link = $rootScope.base_url+'/access_points/add_on_cable' 
				}else{
					link = $rootScope.base_url+'/access_points/add'
				}           
			}

			if ($rootScope.last_kmz_point){
				dataSend.last_kmz_point = true;
			}
			if (Map.KmzKmlImporting){
				KmzKmlImporting = true;
			} else {
				KmzKmlImporting = false;
			}

			// REQUEST
			$.ajax({
				url: link,
				type: 'POST',
				data: dataSend,
				async: !add_synchronously,
				success:function(data){
					if ((!Map.serialAdding) && (!KmzKmlImporting) && (!dataSend.floor_id)){
						$rootScope.set_errors_modal(data,"accessPointAdd");
						KmzKmlImporting = false;
					}
					// If this is not a serial add neither a KMZ import, 
					// lift the db_click block after 2 seconds
					if ((!Map.serialAdding) && (!KmzKmlImporting)){
						setTimeout(function(){
							self.block_dbclick_add_ap = false;
						}, 2000);
					}

					//fecha menu pra evitar clicar novamente gerando erro
					if($rootScope.menuCable){
						$rootScope.menuCable = false;       
						$rootScope.dialogService.close('menuCable');
					}

					if(data.status == 1){
						created_entity = data.data;
						if(!self.editing){
							data = data.data;
							// Success (from old ajax call)
							if(self.addOnCable){
								self.addOnCable = false;
								Cables.redrawCable(Cables.cableSelected.id,false);
								// Bruno
								// Removendo linha abaixo porque ela duplicava o cabo no mapa depois de algo ser adicionado
								// Removendo enquanto trabalho na issue #75
								//Cables.cableSelected.polyline.setMap($rootScope.map.map); //evita que o cabo suma
							}

							accessPoint = [];

							accessPoint.id = data.id;                
							accessPoint.name = data.name;            
							accessPoint.cost = data.cost; 
							accessPoint.color = data.color;
							accessPoint.category = $rootScope.accessPointCategory;
							accessPoint.access_point_type_id = data.access_point_type_id; 
							accessPoint.access_point_type_name = type.name;
							accessPoint.current_type_price = type.price;
							accessPoint.pon = type.pon;
							accessPoint.deploy_information = data.deploy_information; 

							if(data.network_information){
								accessPoint.network_information = data.network_information; 
							}


							if(data.dot){  									                 
								dot = Map.drawSVGMarker(data.dot.lat, data.dot.lng, type.icon.split('.')[0], data.name,
					 			"", data.deploy_information.deployed, self.getApColor(data), "black");
								dot.id = data.dot_id;
								dot.accessPointId = data.id;
								if ((LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_TECNICO]) || 
                LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR])) && ((!accessPoint.deploy_information.deployed) || (accessPoint.id == $rootScope.AccessPoints.moving_id))) {
									dot.setDraggable(true);
								} else {
									dot.setDraggable(false);
								}

								dot.infowindow = Map.drawAccessPointNameInfowindow(accessPoint.name); 

								//dot.setMap(Map.map);
								$rootScope.Markers.addToMap(dot);

								accessPoint.dot = dot;               
								Map.addListenerAccessPoint(accessPoint);

								//Add the node of the new instance to the ap
								//self.addApTreeView(accessPoint.id, type.icon, accessPoint.name, self.accessPoints[data.category].length - 1, data.category);
							}

							switch(data.category){
							case 1:
								//fontes
								self.accessPoints[1].push(accessPoint); 
								break;	
							case 2:
								//armário
								self.accessPoints[2].push(accessPoint); 
								break;	
							case 3:
								//pacs
								if (data.dot){
									accessPoint.circle = Map.drawCircle(data.dot.lat, data.dot.lng,100, accessPoint);
								}
								if (self.viewAllCircles){
									accessPoint.circle.setMap(Map.map);
									//$rootScope.Markers.addToMap(accessPoint.circle);
								}
								self.accessPoints[3].push(accessPoint); 
								break;	
							case 4:
								//caixas de emenda
								self.accessPoints[4].push(accessPoint); 
								break;	
						case 5:
							//caixas de atendimento
							if (data.dot){
								accessPoint.circle = Map.drawCircle(data.dot.lat, data.dot.lng,type.radius, accessPoint);
							}
							if (self.viewAllCircles){
								accessPoint.circle.setMap(Map.map);
								//$rootScope.Markers.addToMap(accessPoint.circle);
							}
							self.accessPoints[5].push(accessPoint); 
							break;	
						case 6:
							//cameras
							if (data.dot){
								accessPoint.circle = Map.drawCircle(data.dot.lat, data.dot.lng,type.radius, accessPoint);
							}
							if (self.viewAllCircles){
								accessPoint.circle.setMap(Map.map);
								//$rootScope.Markers.addToMap(accessPoint.circle);
							}
							self.accessPoints[6].push(accessPoint); 
							break;	
						default:
							//Se nao tiver category nao vai colocar em lugar nenhum pra nao comprometer o funcionamento
							break;
							}
							if(data.dot){
								self.addApTreeView(accessPoint.id, type.icon, accessPoint.name, self.accessPoints[data.category].length - 1, data.category);
							}

							// Complete (from old ajax call)
							
							if (dataSend.last_kmz_point){
								//If this was a KMZ import call, and it was the last dot, show that the task is completed:
								$rootScope.message_success = $rootScope.Users.translateText('Todos os pontos KMZ foram importados');
								setTimeout(function() {
									$rootScope.message_success = '';
								}, 2000);
								self.KmzKmlImporting = false;
								Map.isLoading = false;
								$rootScope.last_kmz_point = false;
								$rootScope.$apply();
							}
						} else {
							// For editing cases
							self.refreshAccessPoint(data.id);

							data.data.dot.cables.filter(c => c).forEach(cable =>{
								$rootScope.Cables.redrawCable(cable.id, false);
							});

// 							if (dataSend.name && !($rootScope.form.name == dataSend.name)){
								$rootScope.Nodes.changeNodeName(2, dataSend.id, dataSend.name);
// 							}
						}
					} else {
						var options = {
							autoOpen: false,
							modal: true,
							title: $rootScope.Users.translateText("Atenção"),
							width: 300,
							height:"auto",
							resizable:true,
							dialogClass: "noclose alertModal", 
						};
						$rootScope.messageAlert = $rootScope.Users.translateText(data.message);
						model = [];  
						$rootScope.dialogService.open("alertModal","alertModal", model, options).then();
					}
					     
				},
				complete:function(){
					self.isLoading = false;
				}
			});
		
			return created_entity;
		},



		add : function(category){
			Cables.usingPositionOnCable = true;
			switch(category){
				case 1:
					title = $rootScope.Users.translateText('Adicionar fonte');	
					break;
				case 2:
					title = $rootScope.Users.translateText('Adicionar armário');	
					break;
				case 3:
					title = $rootScope.Users.translateText('Adicionar PAC');	
					break;
				case 4:
					title = $rootScope.Users.translateText('Adicionar caixa de emendas');	
					break;
				case 5:
					title = $rootScope.Users.translateText('Adicionar caixa de atendimento');	
					break;
				case 6:
					title = $rootScope.Users.translateText('Adicionar camera');	
					break;
				default:
					break;
			}        

			var options = {
				autoOpen: false,
				modal: true,
				title: title,
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
				}    
			};
			model = [];
			self.block_dbclick_add_ap = false;
			self.typeList();
			$rootScope.form = [];
			$rootScope.accessPointCategory = category;
			$rootScope.form.error = [];
			$rootScope.form.color = "#c0c0c0";
			$rootScope.message_error_modal = '';
		  	if($rootScope.menuMap){
                 $rootScope.menuMap = false;       
                 $rootScope.dialogService.close('menuMap');
            }
          
			dialogService.open('accessPointAdd','accessPointAdd', model, options).then();
		},


		showAll : function(category){
          show = false;
          hide = false;

          switch(category){
            case 1:
              //fontes
              if(!self.viewAllAccessPoints1){
                self.viewAllAccessPoints1 = 1;
                show = true;
              } else{
                hide = true;
                self.viewAllAccessPoints1 = 0;
            }
              break;
            case 2:
              //armário
              if(!self.viewAllAccessPoints2){
                self.viewAllAccessPoints2 = 1;
                show = true;
              } else{
                hide = true;
                self.viewAllAccessPoints2 = 0;
              }
              break;
            case 3:
              //pacs
              if(!self.viewAllAccessPoints3){
                self.viewAllAccessPoints3 = 1;
                show = true;
              } else{
                hide = true;
                self.viewAllAccessPoints3 = 0;
              }
              break;
            case 4:
              //caixas de emenda
              if(!self.viewAllAccessPoints4){
                self.viewAllAccessPoints4 = 1;
                show = true;
              } else{
                hide = true;
                self.viewAllAccessPoints4 = 0;
              }
              break;
            case 5:
              //caixas de atendimento
              if(!self.viewAllAccessPoints5){
                self.viewAllAccessPoints5 = 1;
                show = true;
              } else{
                hide = true;
                self.viewAllAccessPoints5 = 0;
              }
              break;
            case 6:
              //cameras
              if(!self.viewAllAccessPoints6){
                self.viewAllAccessPoints6 = 1;
                show = true;
              } else{
                hide = true;
                self.viewAllAccessPoints6 = 0;
              }
              break;
            default:
              break;
          }

          if(show){
            angular.forEach(self.accessPoints[category],function(el, index){
              //el.dot.setMap(Map.map);
              $rootScope.Markers.addToMap(el.dot);
              el.statusView = 1; 
              //set range circle if necessary
              if ((el.circle) && (Map.viewAllCircles)){
            	  el.circle.setMap(Map.map);
            	  //$rootScope.Markers.addToMap(el.circle);
              }
            });
          }
          if(hide){
            angular.forEach(self.accessPoints[category],function(el, index){
              //el.dot.setMap(null); 
              $rootScope.Markers.removeFromMap(el.dot);
              el.statusView = 0;
              //Unset range circle
              if (el.circle){
            	  el.circle.setMap(null);
            	  //$rootScope.Markers.removeFromMap(el.circle);
              }
            });
          }
      },
      
      showClientsStatus : function(accessPoint, event, viability){
		  var point = null;
		  point = Map.getPointFromLatLng(event);
  		  pageX = point[0];
  		  pageY = point[1];
  		  offset = (($rootScope.treeview) ? $('#jstree-id-width').width() : 0);
  		  //Set Position
			if (viability) {
				$('.clients-status-div').css({
					left: event.domEvent.clientX - 44,
					top: event.domEvent.clientY - 95
				});
			} else {
				$('.clients-status-div').css({
					left: pageX - 48 + offset,
				  top: pageY - 45
				});
			}
    	  
  		  self.showClientsStatusDiv = true;
    	  self.clientsStatusReady = false;
    	  $rootScope.$apply();
		  conns = $rootScope.Connections.getApConnections(accessPoint.id).then(function(conns){
			  var total_ports = 0;
			  var reserved_clients = 0;
			  var connected_clients = 0;
			  var available_ports = 0;
			  angular.forEach(conns, function(conn, conn_idx){
				  if (conn.splitter){
					  
					  total_ports = total_ports + conn.splitter.ports_number;
					  var avail = conn.splitter.ports_number - (conn.fusions_in.length + conn.fusions_out.length);
					  //Check if any fusion is on the input slot. That doesn't count for port availability
					  angular.forEach(conn.fusions_in, function(fusion, idx){
						  if (fusion.fiber_in == 0){
							  avail = avail + 1
						  } else {
							  if (self.connectedNotToClient(fusion, true, conns)){
								  total_ports = total_ports - 1;
							  }
						  }
					  });
					  angular.forEach(conn.fusions_out, function(fusion, idx){
						  if (fusion.fiber_out == 0){
							  avail = avail + 1;
						  } else {
							  if (self.connectedNotToClient(fusion, false, conns)){
								  total_ports = total_ports - 1;
							  }
						  }
					  });
					  available_ports = available_ports + avail;
				  } else if (conn.client){
					  if ((conn.fusions_in.length > 0) || (conn.fusions_out.length > 0)){
						  connected_clients = connected_clients + 1;
					  } else {
						  reserved_clients = reserved_clients + 1;
					  }
				  }
			  });
			  self.totalPorts = total_ports;
			  self.availablePorts = available_ports - reserved_clients;
			  self.reservedClients = reserved_clients;
			  self.connectedClients = connected_clients;
			  self.clientsStatusReady = true;
		  });
			},
			
		get_fiber_route : function(slot){
			self.isLoading = true;
			$.ajax({
				url:  $rootScope.base_url+'/access_points/get_fiber_route',
				type: 'POST',
				data: {fiber:slot.fiber,ap_id:slot.report_data.access_points[slot.report_data.access_points.length -1].id,
				conn_id:slot.connection_id},
				//async:false,
				success:function(response){
					$rootScope.id_FiberCable = 0;
					$rootScope.FiberCable = response;
					self.print_relFiber($rootScope.FiberCable);
					
				},
			});
		//}

		},

		get_fiber_route_complete : function(slot){
			self.isLoading = true;
			var fiber = slot.fiber;
			var ap_id = slot.report_data.access_points[slot.report_data.access_points.length -1].id;
			var conn_id = slot.connection_id;
			$.ajax({
				url:  $rootScope.base_url+'/access_points/get_fiber_route',
				type: 'POST',
				data: {fiber:fiber,ap_id:ap_id,conn_id:conn_id},
				success:function(response){
					$rootScope.id_FiberCable = 0;
					$rootScope.FiberCable = response;
					self.print_relFiber($rootScope.FiberCable);
				},
				error: function(err) {
					console.error(err);
					self.isLoading = false;
				}
			});
		},

		print_relFiber : function(route){

          	var doc = new jsPDF('l', 'pt',[700, 1900]);
			doc.setFontSize(15);
			doc.text("MAPWISP - Relatório Unifilar", 10, 25);
			doc.setFontSize(10);
			doc.text(route[0].access_points[0].name, 10, 40);
			doc.setFontSize(8);
			var pageX = 30;
			var pageY = 100;

			var aux = 0;
			var continuePageX = 0;
			var continuePageY = 50;
			var splPageX = 0;

			var splitter = [];
			var splitters = [];

			while(route[aux]){

				if(!route[aux].drawn){



                if(route[aux].saida){
                    //na primeira saida seta a posicao de acordo com o splitter referencia
					if(route[aux].saida.match('1/')){
						
						for(var x= 0; x < splitters.length;x++){
							if(splitters[x].id === route[aux].splitter_ref_id){
								var xySplitter = splitters[x];
								pageY = xySplitter.pageY;
							}							
						}

						if(pageX<=splPageX){
						    pageX = splPageX + 30;
						}else{
							pageX += 60;
						}
						continuePageX = pageX;

						if ((pageX > 1420) || (pageY > 620)){
							pageX = 30;
							continuePageX = pageX;
							splPageX = pageX;
							doc.addPage();
							pageY = 100;
						}

						if(!route[aux].client_id){
							//escreve o nome ap atual
							doc.setFontType('bold');
							doc.text(route[aux].access_points[0].name.substr(0,15), pageX -20, pageY -20);
							doc.setFontType('normal');
						}

					}else{

						pageX = continuePageX;
						pageY = pageY + 50;

					}

					var ySaida = xySplitter.pageY+((parseInt(route[aux].saida.substring(1,0))-1) * 3);

					if(pageX>xySplitter.pageX){
				        
				        //desenha linha da fibra 
				        doc.line(xySplitter.pageX+10, ySaida, xySplitter.pageX+30, ySaida);
				        doc.line(xySplitter.pageX+30, ySaida, pageX-20, pageY+15);
					    

					}
				}

				for(var i= 0; i < route[aux].access_points.length;i++){

					var fiber = "";
					var ponto = "";
					var fusao = "";

					if(route[aux].fiber_ref >= 0){
						fiber = route[aux].fiber_ref.toString();
					}else if(route[aux].fiber_number >= 0){
						fiber = route[aux].fiber_number;
					}
					if(route[aux].ponto){
						ponto = route[aux].ponto.substr(0,20);
					}

					//get fiber number by conection
					if(fusao = route[aux].access_points[i].fusions[0]){

						var conexao = route[aux].access_points[i].access_point_connections[0].id;
						
						if(conexao === fusao.access_point_connection_id_in){
							fiber = fusao.fiber_in.toString();
						}else if(conexao === fusao.access_point_connection_id_out){
							fiber = fusao.fiber_out.toString();
						}
					
					}else if(!jQuery.isEmptyObject(route[aux].access_points[i].host_port)){
						fiber = route[aux].access_points[i].host_port.fiber.toString();
					}

					if(!route[aux].client_id){
						
						doc.line(pageX-20, pageY + 15, pageX, pageY + 15);						
					    doc.text(fiber, pageX - 20, pageY + 13);
					    
					    var splitter_id = "";
					    var nameAP = route[aux].access_points[i].name;
					    
						if(!jQuery.isEmptyObject(route[aux].access_points[i].splitters)){
							splitter_id = route[aux].access_points[i].splitters[0].splitter.id;
						    nameAP = route[aux].access_points[i].splitters[0].splitter.name;
						}else if(route[aux].splitter_id){
							splitter_id = route[aux].splitter_id;
						}
						
						//escreve nome do cabo, splitter, etc
						if(i===0){

							doc.text(ponto, pageX - 20, pageY -10);

						}else{
							doc.text(nameAP.substr(0,10), pageX-10, pageY - 2);
						}					

						if(splitter_id){

							doc.triangle(pageX, pageY + 15, pageX + 10, pageY + 30 , pageX + 10, pageY);

							//guarda posição do splitter num array para ser usado depois
							splitter=[];
							splitter.ref_id = route[aux].splitter_ref_id;
							splitter.id = splitter_id;
							splitter.pageX = pageX;
							splitter.pageY = pageY;
							splitters.push(splitter);

							//if(route[aux].splitter_id){
								

								for(var j= 0; j < route.length;j++){
									if(route[j].splitter_ref_id === splitter_id
									&& route[j].client_id){
									
                                        doc.line(pageX+10, pageY+((parseInt(route[j].saida.substring(1,0))-1) * 3), 
										pageX+50, pageY+((parseInt(route[j].saida.substring(1,0))-1) * 3));

										doc.setFontSize(4);
										doc.text(route[j].ponto.substr(0,20), 
										pageX+50, pageY+((parseInt(route[j].saida.substring(1,0))-1) * 3));
										doc.setFontSize(8);

										route[j].drawn = true;

									}
								}

							//}

						}else{

							//desenha ap

							doc.line(pageX, pageY + 15, pageX + 15, pageY);
							doc.line(pageX + 15, pageY, pageX + 30 , pageY + 15);
							doc.line(pageX + 30, pageY + 15, pageX + 15, pageY + 30);
							doc.line(pageX + 15, pageY + 30, pageX, pageY + 15);
						}
					}

					pageX = pageX + 50;

					//guarda posição pra continuar e nao desenhar em cima
					if(pageX>splPageX){
					    splPageX = pageX;
					}
				}
				}
				aux++;
			}

			doc.save('MAPWISP-RelatorioDeFibra.pdf');
			self.isLoading = false;

			
		},
      
      /**
       * Pretty specific function. it serves the "showClientsStatus" function
       * It returns TRUE when the fusion that's given is connected to another connection that is NOT a client
       * */
      connectedNotToClient: function(fusion, is_in, conns){
    	  var result = false;
    	  if (is_in){
    		  fusion_conn_id = fusion.access_point_connection_id_out;
    	  } else{
    		  fusion_conn_id = fusion.access_point_connection_id_in;
    	  }
    	  angular.forEach(conns, function(conn, idx_conn){
    		  if (conn.id == fusion_conn_id){
    			  if (!conn.client_id){
	    			  result = true;
    			  }
    		  }
    	  });
    	  return result;
      },
      
      hideClientsStatus: function(){
    	  self.showClientsStatusDiv = false;
    	  $rootScope.$apply();
      },

      getPdfHeight : function(){
    	  left_height = 0;
    	  angular.forEach($rootScope.Connections.hosts, function(host, index_host){
    		  if (host){
				  host.ports.filter(s=>s.port_information.alias && (s.port_information.alias.length/10) > 1).forEach(s=>{
						  left_height += Math.floor(s.port_information.alias.length/10) * 10;
					  });
    			  left_height += 20 * (host.ports.length + 1);
	    		  left_height += 30;
    		  }
    	  });
    	  left_height += 30;
    	  angular.forEach($rootScope.Connections.connections.connectionsLeft, function(conn_left, index_conn_left){
    		  if (conn_left){
	    		  if (conn_left.host_id){
					  conn_left.ports.filter(s=>s.port_information.alias && (s.port_information.alias.length/10) > 1).forEach(s=>{
						  left_height += Math.floor(s.port_information.alias.length/10) * 10;
					  });
	    			  left_height += 20 * (conn_left.ports.length + 1);
	    		  } else {
					  conn_left.slots.filter(s=>s.note && (s.note.length/10) > 1).forEach(s=>{
						  left_height += Math.floor(s.note.length/10) * 10;
					  });
	    			  left_height += 20 * (conn_left.slots.length + 1);
	    		  }
	    		  left_height += 30;
    		  }
    	  });
    	  left_height += 30;
    	  left_height += 90;
    	  
    	  right_height = 0;
    	  angular.forEach($rootScope.Connections.connections.connectionsRight, function(conn_right, index_conn_right){
    		  if (conn_right){
	    		  if (conn_right.host_id){
					  conn_right.ports.filter(s=>s.port_information.alias && (s.port_information.alias.length/10) > 1).forEach(s=>{
						  right_height += Math.floor(s.port_information.alias.length/10) * 10;
					  });
	    			  right_height += 20 * (conn_right.ports.length + 1);
	    		  } else {
					  conn_right.slots.filter(s=>s.note && (s.note.length/10) > 1).forEach(s=>{
						  right_height += Math.floor(s.note.length/10) * 10;
					  });
	    			  right_height += 20 * (conn_right.slots.length + 1);
	    		  }
	    		  right_height += 30;
    		  }
    	  });
    	  right_height += 30;
    	  right_height += 90;
    	  
    	  if (right_height > left_height){
    		  height = right_height + 100;
    	  } else {
    		  height = left_height + 100;
    	  }
    	  //Correcting minimum height - PDF page has to be at least 600pts high.
    	  if (height < 600){
    		  height = 600;
    	  }
    	  return height;
      },

      pdftoimg : function(pdf_data, num, scale2, idd, nome_imagem){
    	  PDFJS.disableWorker = true;
    	  PDFJS.getDocument(pdf_data).then(function(pdf) {
	          pdf.getPage(num).then(function(page) {
	              var canvas = document.createElement('canvas');
	              canvas.id = 'pag' + num;
	              canvas.className = 'grande';
	              canvasContainer = document.getElementById(idd);
	              var context = canvas.getContext('2d');
	              var viewport = page.getViewport(scale2);
	              canvas.height = viewport.height;
	              canvas.width = viewport.width;
	              var renderContext = {
	                  canvasContext: context,
	                  viewport: viewport
	              };
	              page.render(renderContext).then(function(){
	                  canvasContainer.appendChild(canvas);
	                  var dataUrl = canvas.toDataURL();
	                  
	                  var link = document.createElement("a");
	                  link.download = nome_imagem;
	                  link.href = dataUrl;
	                  document.body.appendChild(link);
	                  link.click();
	                  document.body.removeChild(link);
	                  delete link;
	                  self.isLoading = false;
	                  //Send event to analytics
	                  if ($rootScope.run_analytics){
		    			  ga('send', {
		    				  hitType: 'event',
		    				  eventCategory: 'AccessPoint',
		    				  eventAction: 'print_image',
		    				  eventLabel: 'Caixa'
		    			  });
	                  }
	              });
	          });
          });
      },
      
      isClientConn : function(fusion){
    	  for (var i = 0; i < $rootScope.Connections.accessPointConnectionsTemp.connectionsBottom.length; i++){
    		  if ((fusion.access_point_connection_id_in == $rootScope.Connections.accessPointConnectionsTemp.connectionsBottom[i].id) || (fusion.access_point_connection_id_out == $rootScope.Connections.accessPointConnectionsTemp.connectionsBottom[i].id)){
    			  return true;
    		  }
    	  }
    	  return false;
      },

	  svgToPDF : function(saving_image){

		var svgElement = $("#cy")[0];

		// Cria o texto dentro do container que será renderizado
		var apName = document.createElement('div');
		apName.innerText = $rootScope.apVisualizer.accessPointData.name;
		apName.style.position = 'absolute';
		apName.style.top = '10px';
		apName.style.left = '50%';
		apName.style.transform = 'translateX(-50%)';
		apName.style.backgroundColor = '#ffffcc';
		apName.style.padding = '8px 16px';
		apName.style.border = '1px solid #999';
		apName.style.borderRadius = '4px';
		apName.style.fontWeight = 'bold';
		apName.style.zIndex = '1';

		// Insere o texto no mesmo container que o svg está
		svgElement.appendChild(apName);

		html2canvas(svgElement,{backgroundColor: '#ccc'}).then(function(canvas) {
			var imgData = canvas.toDataURL("image/png");
			height = self.getPdfHeight();

			// Remove o texto temporário após capturar
        	svgElement.removeChild(apName);

			if(saving_image){

				var png = new Image();
        		png.src = imgData;
				document.body.appendChild(png);

				var downloadLink = document.createElement("a");
				downloadLink.href = imgData;
				downloadLink.download = $rootScope.apVisualizer.accessPointData.name + ".png";
				downloadLink.click();	

			}else{
				var pdf = new jsPDF('p', 'pt', [ $rootScope.apVisualizer.configuration.width + 50,  
												($rootScope.apVisualizer.configuration.height+0.0)]);
				
				
				pdf.addImage(imgData, "PNG", 5, 5, 
							$rootScope.apVisualizer.configuration.width, 
							$rootScope.apVisualizer.configuration.height,
							'','FAST');

				pdf.save($rootScope.apVisualizer.accessPointData.name + ".pdf");
			}
		});


	  },

      printAccessPoint : function(saving_image){
    	  self.isLoading = true;
    	  //get AP data from the rootScope, in order to generate PDF
    	  accessPoint = $rootScope.Connections.accessPointOpened;
    	  //new PDF in panorama mode, dividet in points 'pt'
    	  height = self.getPdfHeight();
    	  var doc = new jsPDF('p', 'pt', [ 595.28,  (height+0.0)]);
    	  //Set METADATA
    	  doc.setProperties({
    			title: 'MAPWISP 2.0 Access Point Visualization',
    			subject: 'This document shows the connections and fusions of an access point',		
    			author: 'MAPWISP 2.0',
    			keywords: 'generated, mapwisp 2.0, web, access point, fiber',
    			creator: 'MAPWISP 2.0'
    		});
    	  //Draw Header - Name of the AP, centralized
    	  doc.setFontSize(20);
    	  var actualTextWidth = doc.getStringUnitWidth(accessPoint.name, {fontName:'Times', fontStyle:'Roman'}) * 20;
    	  titleStartX = ((592.28/2) - (actualTextWidth/2));
    	  doc.text(accessPoint.name, titleStartX, 40);
    	  
    	  self.connectionsDrawn = [];
    	  self.drewFirstConn = false;
    	  //Draw Hosts on the left
    	  angular.forEach($rootScope.Connections.hosts, function(host, index_host){
    		  //draw host table
    		  self.drawConn(doc, host, 0);
    	  });
    	  
    	  //Draw Connections on the left 
    	  angular.forEach($rootScope.Connections.connections.connectionsLeft, function(conn_left, index_conn_left){
    		  //draw conn on theleft
    		  self.drawConn(doc, conn_left, 0);
    	  });
    	  
    	  self.drewFirstConn = false;
    	  //Draw Connections on the right.
    	  angular.forEach($rootScope.Connections.connections.connectionsRight, function(conn_right, index_conn_right){
    		  //draw conn on the right
    		  self.drawConn(doc, conn_right, 1);
		  });
    	  
    	  self.leftFusionOffset = 0;
    	  self.rightFusionOffset = 0;
		  doc.setLineWidth(3.3);
    	  //Draw fusions
    	  angular.forEach($rootScope.Connections.accessPointConnectionsTemp.fusions, function(fusion, index_fusion){
    		  if (fusion){
    			  // Temporary check in order to fix it
    			  if (!self.isClientConn(fusion)){
    				  self.drawFusion(doc, fusion);
    			  }
    		  }
		  });
		  
		  //Draw host fusions
    	  angular.forEach($rootScope.Connections.hosts, function(host, index_host){
    		  angular.forEach(host.ports, function(port, index_port){
    			  if (port.connection_id){
    				  self.drawHostFusion(doc, port);
    			  }
    		  });
		  });

		  var cli_x = [];
		  var cli_y = height - 125;
		  var id_cn = 0;
		  var aux = 0;
		  
		  doc.setFontSize(8);

		  //Desenha quadrado do cliente
		  self.drewFirstConn = false;
    	  //Draw Connections on the botton.
    	  angular.forEach($rootScope.Connections.connections.connectionsBottom, function(conn_botton, index_conn_botton){
    	  	
					aux = $rootScope.Connections.accessPointConnectionsTemp.connectionsBottom[id_cn].id;
					cli_x[aux] = $rootScope.Connections.accessPointConnectionsTemp.connectionsBottom[id_cn].x;
					
					doc.setDrawColor(95,95,95);
					//Desenha o quadrado do cliente
					doc.rect(cli_x[aux] + 105,cli_y,15,15,'F');

					//var nome = $rootScope.Connections.accessPointConnectionsTemp.connectionsBottom[id_cn].client.name;				
					//doc.text(nome,cli_x[aux] + 100,cli_y + 10);

					id_cn++;
			   

		  });

		  //Desenha a fusão do cliente		  		
		  id_cn = 0;
		  var fiber_aux = 0; 
		  self.leftFusionOffset = 0;
    	  self.rightFusionOffset = 0;
		  doc.setLineWidth(3.3);  
		  doc.setDrawColor(0,0,255);		  

		  angular.forEach($rootScope.Connections.accessPointConnectionsTemp.fusions, function(fusion, index_fusion){
			if (fusion){
				
				// Verifica se é cliente
				if (self.isClientConn(fusion)){

					if (fusion.access_point_connection_out.side == "bottom") {	

						aux = fusion.access_point_connection_id_out	
						fiber_aux = fusion.fiber_in;
						id_con = fusion.access_point_connection_id_in

					} else if (fusion.access_point_connection_in.side == "bottom") {

						aux = fusion.access_point_connection_id_in
						fiber_aux = fusion.fiber_out;
						id_con = fusion.access_point_connection_id_out
					}
					
					//pega a coorderana Y da conexão
					for (i=0;i<self.connectionsDrawn.length;i++){
						if (id_con == self.connectionsDrawn[i][0]){
							connY = self.connectionsDrawn[i][6];
							connSlots = self.connectionsDrawn[i][2];
							break;
						}
					}

					//calcula a coordenada da porta
				  	offset = (20 * (connSlots - fiber_aux)) + 10  ;
					self.fusionStartY = connY - offset;
					
					doc.setDrawColor(0,0,255);

					if (fusion.access_point_connection_in.side == "right" || fusion.access_point_connection_out.side == "right" ){											
						
						self.fusionStartX = 420;

					    doc.line(self.fusionStartX, self.fusionStartY , self.fusionStartX - 25 , self.fusionStartY);
					    doc.line(self.fusionStartX - 25, self.fusionStartY , cli_x[aux] + 115, cli_y);

					}else {
						
						self.fusionStartX = 175;

				  		doc.line(self.fusionStartX, self.fusionStartY , self.fusionStartX + 25 , self.fusionStartY);
						doc.line(self.fusionStartX + 25, self.fusionStartY , cli_x[aux] + 115, cli_y );
					}

				}
			}				
		  });

    	  self.leftFusionOffset = 0;
    	  self.rightFusionOffset = 0;

    	  var ident = $rootScope.identifier.company_name;
		  
		  name = accessPoint.name;
		  if (saving_image){
			  //self.pdftoimg(doc.output("bloburl"), 1, 4, 'canvas_pdf_to_img', 'MAPWISP-'+name+'');
			  //Other possibility:
			  self.pdftoimg(doc.output("arraybuffer"), 1, 4, 'canvas_pdf_to_img', ident+'-'+name+'');
		  } else {

              var ident = $rootScope.identifier.company_name;

			  doc.save(ident+'-'+name+'.pdf');
			  self.isLoading = false;
			  //Send event to analytics
			  if ($rootScope.run_analytics){
				  ga('send', {
					  hitType: 'event',
					  eventCategory: 'AccessPoint',
					  eventAction: 'print_pdf',
					  eventLabel: 'Caixa'
				  });
			  }
		  }
		  self.drewFirstConn = false;
      }, // fim da função saving_image

	  drawHostFusion : function(doc, port){
    	  if (!port.connected){
    		  return;
    	  }
    	  self.getPortStartEnd(port);
    	  self.drawLine(doc);
      },
      
      drawFusion : function(doc, fusion){
    	  self.getFusionStartEnd(fusion);
    	  self.drawLine(doc,fusion);
      },
      
      drawLine : function(doc,fusion){
    	  startX = self.fusionStartX;
    	  startY = self.fusionStartY;
    	  endX = self.fusionEndX;
    	  endY = self.fusionEndY;

    	  
    	  if ((startX == 175) && (endX == 175)){
    		  //Both on the left
    		  doc.setDrawColor(self.startColorR,self.startColorG,self.startColorB);
        	  
    		  doc.line(startX, startY, startX + 25 + self.leftFusionOffset, startY);
    		  doc.line(startX + 25 + self.leftFusionOffset, startY, startX + 25 + self.leftFusionOffset, (startY+endY)/2);
    		  
    		  doc.setDrawColor(self.endColorR,self.endColorG,self.endColorB);
    		  
    		  doc.line(startX + 25 + self.leftFusionOffset, (startY+endY)/2, endX + 25 + self.leftFusionOffset, endY);
    		  doc.line(endX + 25 + self.leftFusionOffset, endY, endX, endY);
    		  
    		  //One more in the left offset
    		  self.leftFusionOffset = self.leftFusionOffset + 10;
    	  } else if ((startX == 420) && (endX == 420)){
    		  //Both on the right
    		  doc.setDrawColor(self.startColorR,self.startColorG,self.startColorB);
        	  
    		  doc.line(startX, startY, startX - 25 - self.rightFusionOffset, startY);
    		  doc.line(startX - 25 - self.rightFusionOffset, startY, startX - 25 - self.rightFusionOffset, (startY+endY)/2);
    		  
    		  doc.setDrawColor(self.endColorR,self.endColorG,self.endColorB);
    		  
    		  doc.line(startX - 25 - self.rightFusionOffset, (startY+endY)/2, endX - 25 - self.rightFusionOffset, endY);
    		  doc.line(endX - 25 - self.rightFusionOffset, endY, endX, endY);
    		  
    		  //One more in the left offset
    		  self.rightFusionOffset = self.rightFusionOffset + 10;
    	  } else if (startX == 175){
    		  //From left to right
    		  doc.setDrawColor(self.startColorR,self.startColorG,self.startColorB);
        	  
    		  doc.line(startX, startY, startX + 25, startY);
    		  doc.line(startX + 25, startY, (startX + 25 + endX - 25)/2, (startY+endY)/2);
    		  
    		  doc.setDrawColor(self.endColorR,self.endColorG,self.endColorB);
    		  
    		  doc.line((startX + 25 + endX - 25)/2, (startY+endY)/2, endX - 25, endY);
    		  doc.line(endX - 25, endY, endX, endY);
    		  
    		  
    	  } else {
					//From right to left
					var aux_conn_in = $rootScope.Fusions.findConnection(fusion.access_point_connection_id_in);
    		  if(fusion.fiber_in > 12 && aux_conn_in.cable.cable_type && 12 < (aux_conn_in.cable.cable_type.number_fibers/aux_conn_in.cable.cable_type.tubes)){
				
				  if(fusion.fiber_in > 24){
				  	self.startColorR = 235
				  	self.startColorG = 235
				  	self.startColorB = 235
				  	self.endColorR = 235
				  	self.endColorG = 235
				  	self.endColorB = 235
				  }

				  doc.setLineWidth(1.1);

			  	  doc.setDrawColor(self.startColorR,self.startColorG,self.startColorB);

				  doc.line(startX, startY-1, startX - 25, startY-1);
				  doc.line(startX - 25, startY-1, (startX - 25 + endX + 25)/2, ((startY+endY)/2)-1);

				  doc.setDrawColor(self.endColorR,self.endColorG,self.endColorB);

				  doc.line((startX - 25 + endX + 25)/2, ((startY+endY)/2)-1, endX + 25, endY-1);
				  doc.line(endX + 25, endY-1, endX, endY-1);
				
				  //insere linha branca no meio
				  doc.setDrawColor(235,235,235);
				  doc.line(startX, startY, startX - 25, startY);
				  doc.line(startX - 25, startY, (startX - 25 + endX + 25)/2, (startY+endY)/2);
				  doc.line((startX - 25 + endX + 25)/2, (startY+endY)/2, endX + 25, endY);
				  doc.line(endX + 25, endY, endX, endY);

				  doc.setDrawColor(self.startColorR,self.startColorG,self.startColorB);

				  doc.line(startX, startY+1, startX - 25, startY+1);
				  doc.line(startX - 25, startY+1, (startX - 25 + endX + 25)/2, ((startY+endY)/2)+1);

				  doc.setDrawColor(self.endColorR,self.endColorG,self.endColorB);

				  doc.line((startX - 25 + endX + 25)/2, ((startY+endY)/2)+1, endX + 25, endY+1);
				  doc.line(endX + 25, endY+1, endX, endY+1);

			  }else{

				  doc.setLineWidth(3.3);

				  doc.setDrawColor(self.startColorR,self.startColorG,self.startColorB);

				  doc.line(startX, startY, startX - 25, startY);
				  doc.line(startX - 25, startY, (startX - 25 + endX + 25)/2, (startY+endY)/2);

				  doc.setDrawColor(self.endColorR,self.endColorG,self.endColorB);

				  doc.line((startX - 25 + endX + 25)/2, (startY+endY)/2, endX + 25, endY);
				  doc.line(endX + 25, endY, endX, endY);
				
			  }

    		  
    		  
    	  }
      },
      
      /**
       * Get Fusion Start End method
       * Based on the fusion array sets all the values needed for the drawing of the lines
       * startX, startY, endX, endY, startColorR, startColorG, startColorB, endColorR, endColorG, endColorB
       * */
	  getFusionStartEnd : function(fusion){
		  angular.forEach(self.connectionsDrawn, function(conn, index_conn){
			  if (conn[0] == fusion.access_point_connection_id_in){
				  //Define the X 
				  if (conn[4] == 1){
					  self.fusionStartX = 420; 
				  } else {
					  self.fusionStartX = 175; 
				  }
				  //Define the Y
				  self.fusionStartY = fusion.access_point_connection_in.rowY + 10;

				  var fiber_color;
				  
				  //Set Colors
				  if (conn[8]){
					  fiber_color = fusion.fiber_in % ((conn[2]/conn[8]));
				  }
				  if (fiber_color == 0){
					  fiber_color = (conn[2]/conn[8]);
				  }
				  var aux_conn_in = $rootScope.Fusions.findConnection(fusion.access_point_connection_id_in);
				  if(fiber_color > 12 && aux_conn_in.cable.cable_type && 12 < (aux_conn_in.cable.cable_type.number_fibers/aux_conn_in.cable.cable_type.tubes)){
				  	if(fiber_color > 24){
						fiber_color = 4 //white
				  	}else{
				  		fiber_color = fiber_color - 12;
				  	}
				  }

				  if (conn[7] === 3){
					self.startColorR = 0;
					self.startColorG = 0;
					self.startColorB = 255;	
				  }else if(!conn[7]){
					self.startColorR = 95;
					self.startColorG = 95;
					self.startColorB = 95;
				  }else{

					if(self.colorCode[conn[7]][fiber_color] === undefined){
						fiber_color = fiber_color - 12;
					}
					
					self.startColorR = self.colorCode[conn[7]][fiber_color][0];
					self.startColorG = self.colorCode[conn[7]][fiber_color][1];
					self.startColorB = self.colorCode[conn[7]][fiber_color][2];				
				  }
			  }
			  if (conn[0] == fusion.access_point_connection_id_out){
				  //Define the X
				  if (conn[4] == 1){
					  self.fusionEndX = 420; 
				  } else {
					  self.fusionEndX = 175; 
				  }
				  //Define the Y
				  self.fusionEndY = fusion.access_point_connection_out.rowY + 10;
				  
				  //Set Colors
				  if (conn[8]){
					  fiber_color = fusion.fiber_out % ((conn[2]/conn[8]));
				  }
				  if (fiber_color == 0){
					fiber_color = (conn[2]/conn[8]);
				  }
				  if ((!typeof(fiber_color) == undefined) && fiber_color == 0){
					  fiber_color = (conn[2]/conn[8]);
				  }
				  //Se tiver mais tubos, e digamos que tem 6 fibras por tubo, 
				  //o ciclo de cores fica se repetindo, recomeçando pra cada tubo
				  if(fiber_color > 12){
					var aux_conn_in = $rootScope.Fusions.findConnection(fusion.access_point_connection_id_in);
					if(aux_conn_in.cable.cable_type){
						if (6 <= (aux_conn_in.cable.cable_type.number_fibers/aux_conn_in.cable.cable_type.tubes)){
							if(fiber_color > 24){
							fiber_color = 4; //white
							}else{
								fiber_color = fiber_color - 12;
							}
						}else if (1 === (aux_conn_in.cable.cable_type.number_fibers/aux_conn_in.cable.cable_type.tubes)){
							fiber_color = fiber_color - 12; 
						}else if (4 === (aux_conn_in.cable.cable_type.number_fibers/aux_conn_in.cable.cable_type.tubes)){
							fiber_color = 4; 
						}
					}else{
						fiber_color = fiber_color - 12;
					}
				}
				if (conn[7] === 3){
					self.endColorR = 0;
					self.endColorG = 0;
					self.endColorB = 255;	
				}else if(!conn[7]){
					self.endColorR = 95;
					self.endColorG = 95;
					self.endColorB = 95;
				}else{
					//Em alguns casos acontece do número de fibras ser maior do que o codigo de cores
					//como no caso fiber jet onde uma faixa branca fica no meio da fibra
					//Será necessário adicionar isso no pdf
					//Enquanto isso, essa condição evita dar erro 
					if(self.colorCode[conn[7]][fiber_color] === undefined){
						fiber_color = fiber_color - 12;
					}
					self.endColorR = self.colorCode[conn[7]][fiber_color][0];
					self.endColorG = self.colorCode[conn[7]][fiber_color][1];
					self.endColorB = self.colorCode[conn[7]][fiber_color][2];				
				}
			  }
		  });
	  },
	  
      /**
       * Get Port Start End method
       * Based on the port array sets all the values needed for the drawing of the lines
       * startX, startY, endX, endY, startColorR, startColorG, startColorB, endColorR, endColorG, endColorB
       * */
	  getPortStartEnd : function(port){
    	  //Hosts always are drawn on the left, so StarX will always be 175
    	  self.fusionStartX = 175;
    	  //Start color is always black, as its always originating from a host:
    	  self.startColorR = 0;
		  self.startColorG = 0;
		  self.startColorB = 0;

		  var fiber_color = 0;
		  
    	  angular.forEach(self.connectionsDrawn, function(conn, index_conn){
    		  if ((conn[3] == 1) && (conn[0] == port.host_id)){
    			  //Set startY
				  self.fusionStartY = port.rowStartY + 10;
    		  }
    		  if ((conn[3] == 0) && (conn[0] == port.connection_id)){
    			  //Set endX
    			  if (conn[4] == 1){
    				  self.fusionEndX = 420; 
    			  } else {
    				  self.fusionEndX = 175; 
    			  }
    			  //Set endY	
				  self.fusionEndY = port.rowEndY + 10;
				  
    			  //Set colors
				  if (conn[8]){
					  fiber_color = port.fiber % ((conn[2]/conn[8]));
				  }
				  if ((!typeof(fiber_color) == undefined) && fiber_color == 0){
					  fiber_color = (conn[2]/conn[8]);
				  }
				  //o ciclo de cores fica se repetindo, recomeçando. Isso corrige bug ao imprimir pdf
				  if(fiber_color > 12){
					  fiber_color = fiber_color - 12;
				  }
				  if (conn[7] === 3){
					self.endColorR = 0;
					self.endColorG = 0;
					self.endColorB = 255;	
				  }else if(!conn[7]){
					self.endColorR = 95;
					self.endColorG = 95;
					self.endColorB = 95;
				  }else{
					self.endColorR = self.colorCode[conn[7]][fiber_color][0];
					self.endColorG = self.colorCode[conn[7]][fiber_color][1];
					self.endColorB = self.colorCode[conn[7]][fiber_color][2];				
				  }
    		  }
    	  });
	  },
	  
      drawConn : function(doc, conn, rightLeft){
    	  columns = self.generateColumns(conn, rightLeft);
    	  rows = self.generateRows(conn, rightLeft);
    	  
    	  if (self.drewFirstConn){
    		  connStartY = doc.autoTableEndPosY() + 30;
    	  } else {
    		  connStartY = 90;
    	  }
		
		  var onDrawCell = function(conn) {
			  return function(cell, data) {
				  var fiberId = conn.splitter_id ? data.row.index : data.row.index +1;
					//armazena a posição y da celula criada

				  //procura nos hosts a conexão e armazena Y da entrada e saída
				  $rootScope.Connections.hosts.filter(c2 => c2.ports.filter((s2, index) => s2.host_id === conn.id 
					  && index === data.row.index).forEach(port => {
					    port.rowStartY = data.row.y;
					  }));

				  $rootScope.Connections.hosts.filter(c2 => c2.ports.filter(s2 => s2.connection_id === conn.id 
					&& s2.fiber === fiberId).forEach(port =>{
						port.rowEndY = data.row.y;
					}));
				  
				  $rootScope.Connections.accessPointConnectionsTemp.fusions.filter(fus => fus && (fus.access_point_connection_id_in ===  conn.id
						&& fus.fiber_in === fiberId)).forEach(f =>{
						f.access_point_connection_in.rowY = data.row.y;
					});
				  $rootScope.Connections.accessPointConnectionsTemp.fusions.filter(fus => fus && (fus.access_point_connection_id_out ===  conn.id
						&& fus.fiber_out === fiberId)).forEach(f =>{
						f.access_point_connection_out.rowY = data.row.y;
					});
			  }
			}
    	  
    	  if (rightLeft == 0){
    		  // Left
    		  doc.autoTable(columns, rows, {
					drawCell: onDrawCell(conn),
    			  styles: {
							halign: 'right',
							overflowColumns: false 
    			  },
    			  headerStyles: {
							fontSize: 6,
							halign: 'center',
							overflow: 'linebreak'
    			  },
    			  bodyStyles: {
    				  fontSize: 8,
					  overflow: 'linebreak'
    			  },
    		      startY: connStartY,
    		      pageBreak: 'avoid',
    		      margin: {right: 420}
    		  });
    		  self.drawBorder(doc, connStartY, doc.autoTableEndPosY(), 0);
    	  } else if (rightLeft == 1){
    		  //Right
    		  doc.autoTable(columns, rows, {
				  drawCell: onDrawCell(conn),
    			  styles: {
							halign: 'left',
							overflowColumns: false 
    			  },
    			  headerStyles: {
							fontSize: 6,
							halign: 'center',
							overflow: 'linebreak'
    			  },
    			  bodyStyles: {
    				  fontSize: 8,
					  overflow: 'linebreak'
    			  },
    		      startY: connStartY,
    		      pageBreak: 'avoid',
    		      margin: {left: 420}
    		  });
    		  self.drawBorder(doc, connStartY, doc.autoTableEndPosY(), 1);
    	  }
    	  self.drewFirstConn = true;
    	  if (conn.host_type_id){
    		  self.connectionsDrawn.push([conn.id, self.connDrawOrder, conn.ports.length, 1, rightLeft, connStartY, doc.autoTableEndPosY()]);
    	  } else {
    		  if (conn.splitter_id){
    			  self.connectionsDrawn.push([conn.id, self.connDrawOrder, conn.slots.length - 1, 0, rightLeft, connStartY, doc.autoTableEndPosY()]);
    		  
    		   } else {
    			  self.connectionsDrawn.push([conn.id, self.connDrawOrder, conn.slots.length, 0, rightLeft, connStartY, doc.autoTableEndPosY(), conn.cable.cable_type.code_color, conn.cable.cable_type.tubes]);
    		  }
    	  }
      },
      
      generateColumns : function(conn, rightLeft){
		var nextAp = conn.next_ap ? $rootScope.Users.translateText('Em direção a') + " " + conn.next_ap.name.substr(0,20) : "";
    	  if (rightLeft == 0){
    		  // Left
        	  if (conn.host_type_id){
        		  columns = ["ATIVO "+conn.name.substr(0,20), ""];
        	  } else if (conn.splitter_id){
        		  if (conn.splitter.type < 2){
        			  columns = ["SPLITTER "+conn.splitter.name.substr(0,20), ""];
        		  } else if (conn.splitter.type == 2){
        			  columns = ["PAC "+conn.splitter.name.substr(0,20), ""];
        		  } else if (conn.splitter.type == 3){
        			  columns = ["PAC PON "+conn.splitter.name.substr(0,20), ""];
        		  }
        	  } else {
        		  columns = [nextAp,conn.cable.name.substr(0,20)];
        	  }
    	  } else if (rightLeft == 1){
    		  //Right
        	  if (conn.host_type_id){
        		  columns = ["", conn.name.substr(0,20)+" ATIVO"];
        	  } else if (conn.splitter_id){
        		  if (conn.splitter.type < 2){
        			  columns = ["", conn.splitter.name.substr(0,20)+ " SPLITTER "];
        		  } else if (conn.splitter.type == 2){
        			  columns = ["", conn.splitter.name.substr(0,20)+ " PAC "];
        		  } else if (conn.splitter.type == 3){
        			  columns = ["", conn.splitter.name.substr(0,20)+ " PAC PON "];
        		  }
        	  } else {
        		  columns = [conn.cable.name.substr(0,20),nextAp];
        	  }
    	  }
    	  return columns;
      },
      
      generateRows : function(conn, rightLeft){
		rows = [];
		if (conn.host_type_id){
			slots = conn.ports;
		} else {
			slots = conn.slots;
		}
		angular.forEach(slots, function(slot, slot_index){
			var aliasOrNumber = 0;
			if (rightLeft == 0){
				// Left
				if (conn.host_type_id){
					aliasOrNumber = slot.port_information.alias ? slot.port_information.alias : slot.port_information.number;
					rows.push([slot.port_information.power+"dB", aliasOrNumber]);
				} else if (conn.splitter_id && (conn.splitter.out_one != conn.splitter.out_two)){
					if (slot.fiber == 1){
						rows.push([slot.note + "   " + conn.splitter.out_one + "%", slot.fiber]);
					} else if (slot.fiber == 2){
						rows.push([slot.note + "   " + conn.splitter.out_two + "%", slot.fiber]);
					} else if (slot.fiber == 0 || slot.fiber == -1){
						rows.push([slot.note, slot.fiber]);
					}
				} else {

					rows.push([slot.note, slot.fiber]);
					
				}
			} else if (rightLeft == 1){
				//Right
				if (conn.host_type_id){
					aliasOrNumber = slot.port_information.alias ? slot.port_information.alias : slot.port_information.number;
					rows.push([aliasOrNumber, slot.port_information.power+"dB"]);
				} else if (conn.splitter_id && (conn.splitter.out_one != conn.splitter.out_two)){
					if (slot.fiber == 1){
						rows.push([slot.fiber, conn.splitter.out_one + "%   " + slot.note]);
					} else if (slot.fiber == 2){
						rows.push([slot.fiber, conn.splitter.out_two + "%   " + slot.note]);
					} else if (slot.fiber == 0 || slot.fiber == -1){
						rows.push([slot.fiber, slot.note]);
					}
				} else {

				  	rows.push([slot.fiber, slot.note]);
					
				}  
			}
		});
		return rows;
	},

	rename : function(id,new_name){

		var dataSend = {};
		dataSend.id = id;
		dataSend.name = new_name;

		link = $rootScope.base_url+'/access_points/edit'
			
		$.ajax({
				url: link,
				type: 'POST',
				data: dataSend,
				success:function(data){
					self.refreshAccessPoint(id);
				}});

	},
      
      drawBorder : function(doc, startY, endY, rightLeft){
		  doc.setDrawColor(0,0,0);
		  doc.setLineWidth(0.7);
		  if (rightLeft == 1){
			  //1 for RIGHT!
			  leftX = 420;
			  rightX = 555;
		  } else if (rightLeft == 0){
			  //0 for LEFT
			  leftX = 40;
			  rightX = 175;
		  }
		  doc.line(rightX, endY, rightX, startY); //Vertical Right
		  doc.line(leftX, endY, leftX, startY); //Vertical Left
		  doc.line(leftX, startY, rightX, startY); //Horizontal Top
		  doc.line(leftX, endY, rightX, endY); //Horizontal Botton
      }  
	}
    
	// self.colorCode = [];
	// //					 N	  blue		orange		  green		brown		gray		  white		   red 		black		yellow	  violet	   pink 		acqua
	// self.colorCode[1] = [[],[0,0,255],[255,178,102],[0,255,0],[139,69,19],[128,128,128],[235,235,235],[255,0,0],[0,0,0],[255,255,0],[238,130,238],[255,192,203],[0,255,255]];
	// //					 N	 green 		yellow		white		 blue 	   red			violet		brown		pink		black	   gray			orange		acqua
	// self.colorCode[2] = [[],[0,255,0],[255,255,0],[235,235,235],[0,0,255],[255,0,0],[238,130,238],[139,69,19],[255,192,203],[0,0,0],[128,128,128],[255,178,102],[0,255,255]];
	// // Fiberhome 16		 N	 blue	   green	 red	   yellow	   blue	   	green	   red	    yellow	     blue	   green	 red	   yellow	   blue	     green	   red	    yellow	   
	// self.colorCode[3] = [[],[0,0,255],[0,255,0],[255,0,0],[255,255,0],[0,0,255],[0,255,0],[255,0,0],[255,255,0],[0,0,255],[0,255,0],[255,0,0],[255,255,0],[0,0,255],[0,255,0],[255,0,0],[255,255,0]];
	// // Fiberhome 32		 N	 blue	   green	 red	   yellow	   orange		 brown	     gray	       violet		white		  white			white		   white
	// self.colorCode[4] = [[],[0,0,255],[0,255,0],[255,0,0],[255,255,0],[255,178,102],[139,69,19],[128,128,128],[238,130,238],[0,0,255],[0,255,0],[255,0,0],[255,255,0],[255,178,102],[139,69,19],[128,128,128],[238,130,238]];
	// // C64		 		 N	  green	 	red	  	  blue    	yellow	  		gray        violet       brown		orange		
	// self.colorCode[5] = [[],[0,255,0],[255,0,0],[0,0,255],[255,255,0],[128,128,128],[238,130,238],[139,69,19],[255,178,102]];
	// // ABNT2			 N	 green 		yellow		white		 blue 	   red			violet		brown		pink		black	   gray			orange		acqua
	// self.colorCode[6] = [[],[0,255,0],[255,255,0],[235,235,235],[0,0,255],[255,0,0],[238,130,238],[139,69,19],[255,192,203],[0,0,0],[128,128,128],[255,178,102],[0,255,255]];
	// // MOVISTAR		 		 N	  green	 	red	  	  blue    	yellow	  		gray        violet       brown		orange		
	// self.colorCode[7] = [[],[0,255,0],[255,0,0],[0,0,255],[255,255,0],[128,128,128],[238,130,238],[139,69,19],[255,178,102]];
	// // CHINES 1			 N	  blue		orange		  green		brown		gray		  white		   red 		black		yellow	  violet	   pink 		acqua
	// self.colorCode[8] = [[],[0,0,255],[255,178,102],[0,255,0],[139,69,19],[128,128,128],[235,235,235],[255,0,0],[0,0,0],[255,255,0],[238,130,238],[255,192,203],[0,255,255]];
	// // KP 32             N   green     red       blue      yellow      gray          violet        brown       orange
	// self.colorCode[9] = [[],[0,255,0],[255,0,0],[0,0,255],[255,255,0],[128,128,128],[238,130,238],[139,69,19],[255,178,102]];
    // // KP 48              N   green     red       blue      yellow      gray          violet        brown       orange
	// self.colorCode[10] = [[],[0,255,0],[255,0,0],[0,0,255],[255,255,0],[128,128,128],[238,130,238],[139,69,19],[255,178,102]];
    // // KP 64              N   green     red       blue      yellow      gray          violet        brown       orange
	// self.colorCode[11] = [[],[0,255,0],[255,0,0],[0,0,255],[255,255,0],[128,128,128],[238,130,238],[139,69,19],[255,178,102]];
    // // Internacional 8 FO N   green     red       blue      yellow      gray          violet        brown       orange
	// self.colorCode[12] = [[],[0,255,0],[255,0,0],[0,0,255],[255,255,0],[128,128,128],[238,130,238],[139,69,19],[255,178,102]];
	// // REDIBER 72 FO	  N   red       green     blue      yellow      gray          white         orange        brown       acqua       violet        black   pink
	// self.colorCode[13] = [[],[255,0,0],[0,255,0],[0,0,255],[255,255,0],[128,128,128],[235,235,235],[255,178,102],[139,69,19],[0,255,255],[238,130,238],[0,0,0],[255,192,203]];


	return self;

})

