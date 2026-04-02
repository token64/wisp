app.service("Clients", function(Map,Functions,$rootScope,$interval, dialogService, Cables, Projects,LevelsAndModes,$timeout){
	
	var self = {
			isLoading : false,
			viewClients : false,
			editing : false,
			adding : false,
			addOnCable : false,
			clients : [],
			bulkEdit : false,
			bulkUndeploy : false,
			bulkDeploy : false,
			searchAddress: false,
			clients_loaded_width : "0%",
			//svg path
			path : "M18 22.082v-1.649c2.203-1.241 4-4.337 4-7.432 0-4.971 0-9-6-9s-6 4.029-6 9c0 3.096 1.797 6.191 4 7.432v1.649c-6.784 0.555-12 3.888-12 7.918h28c0-4.030-5.216-7.364-12-7.918z",
	
		    add_old : function(){
		    	Cables.usingPositionOnCable = true;
		        var options = {
		             autoOpen: false,
		             modal: true,
		             title: $rootScope.Users.translateText("Adicionar Cliente"),
		             width: 300,
		             height:"auto",
		             resizable:true,
		             dialogClass: "noclose",
		             close: function(){
		            	 $rootScope.form = [];
		             },
		        };
		        model = [];  
		        self.adding = true;
		        $rootScope.form = [];
		        $rootScope.form.error = [];
		        if($rootScope.menuMap){
	                 $rootScope.menuMap = false;       
	                 $rootScope.dialogService.close("menuMap");
	            } else if($rootScope.menuCable){
	                 $rootScope.menuCable = false;       
	                 $rootScope.dialogService.close("menuCable");
	            }
		        $rootScope.dialogService.open("clientAdd","clientAdd", model, options).then();
		   },
		   
           add : function(add_synchronously){
        	   if (!Map.KmzKmlImporting){
					if (self.block_dbclick_add_client){
						return;
					}
					self.block_dbclick_add_client = true;
				}
	    	   
	    	   
	    	   self.isLoading = true;
	    	   var created_entity = null;
	    	   
	           $rootScope.form.error = [];
	           var data = {};
	           if(self.editing){
				   data.name = $rootScope.form.name;
				   data.serial_onu = $rootScope.form.serial;
				   data.color = $rootScope.form.color;
	           } else {
	        	   if ($rootScope.form.name){
	        		   data.name = $rootScope.form.name;
	        	   } else {
	        		   data.name = $rootScope.Users.translateText("Cliente de nome indefinido"); 
				   }				   
	           }
	           data.dot = {};
			   
			   if ($rootScope.form.router_type){
				   angular.forEach(self.routerTypes, function(router_type, router_type_index){
					   if (router_type.id == $rootScope.form.router_type){
						   data.router = {};
						   data.router.cost = router_type.price;
						   data.router.router_type_id = router_type.id;
						   data.router.fiber = 1;
					   }
				   });
			   }
               
	           

	           if(self.editing){
	                link = $rootScope.base_url+"/clients/edit";  
	                data.id = $rootScope.form.id;
	                data.dot.lat = $rootScope.form.lat;
				    data.dot.lng = $rootScope.form.lng;
	           }else{
	        	   if(Cables.positionOnCable && Cables.cableSelected){
		    		   self.addOnCable = true;
	        		   link = $rootScope.base_url+"/clients/add_on_cable";
		    		   data.cable = Cables.cableSelected.id;
		    		   data.dot.lat = Cables.positionOnCable.event.latLng.lat();
		    		   data.dot.lng = Cables.positionOnCable.event.latLng.lng();
		    		   
		    		   if(Cables.positionOnCable.positioning == "begin"){
		    			   data.dot.id = Cables.positionOnCable.dot_id;
		    			   data.next_dot = Cables.positionOnCable.next_dot;
		    			   data.position = 1;
		    		   }
		    		   if(Cables.positionOnCable.positioning == "end"){
		    			   data.prev_dot = {};
		    			   data.dot.id = Cables.positionOnCable.dot_id;
		    			   data.prev_dot = Cables.positionOnCable.prev_dot;
		    			   data.position = 3;
		    		   }

		    		   if(Cables.positionOnCable.positioning == "middle"){
		    			   //TODO
		    			   //Prohibit this somehow - clients are not added to the beggining of the cable
		    			   data.prev_dot = Cables.positionOnCable.prevDot.id;
		    			   data.position = 2;
		    		   }
		    		   Cables.positionOnCable = false;
		    	   } else {
		    		   self.addOnCable = false;
		               link = $rootScope.base_url+"/clients/add";
		               if (Map.serialAdding || Map.KmzKmlImporting){
		            	   data.dot.lat = $rootScope.current_position.lat;
		            	   data.dot.lng = $rootScope.current_position.lng; 	
		               } else {
		            	   if ($rootScope.event){
		            		   data.dot.lat = $rootScope.event.latLng.lat();
		            		   data.dot.lng = $rootScope.event.latLng.lng();
		            	   }
		               }
		               if ($rootScope.form.apartment_id){
		            	   data.apartment_id = $rootScope.form.apartment_id;
		               }
		    	   }
	        	   Cables.usingPositionOnCable = false;
	           }

	           //KMZ Vars
	           if ($rootScope.last_kmz_point){
	        	   last_kmz_point = true;
	           } else {
	        	   last_kmz_point = false;
	           }

	           if (Map.KmzKmlImporting){
	        	   KmzKmlImporting = true;
	           } else {
	        	   KmzKmlImporting = false;
	           }
	           //-----------------------------

	           $.ajax({
	        	   url: link,
	        	   type: "POST",
	        	   data: data,
	        	   async: !add_synchronously,
	        	   success:function(response){
	        		   if(response.status == 1){
	        			   created_entity = response.data;
	        			   
	        			   if(self.editing){

                               //em alguns casos estava duplicando cliente ao editar
							   var client = self.findClient(response.id);
                               $rootScope.Markers.removeFromMap(client.marker, $rootScope.Markers.clientsMarkerCluster);

	        				   self.redrawClient(response.id);
	        				   response.data.dot.cables.filter(c => c).forEach(cable =>{
									$rootScope.Cables.redrawCable(cable.id, false);
								});
	        				   if (data.name){
	        					   $rootScope.Nodes.changeNodeName(4, data.id, data.name);
	        				   }
	        				   $rootScope.dialogService.close("clientAdd");
	        			   } else {
							   // Substitute ajax GET call, with the entity returned already in the add call
	        				   data = response.data;

	        				   // Success
    						   client = data;
							   client.deploy_information = data.deploy_information;
							   var borderColor = self.getClientBorder(client);
    						   if (data.dot){
									client.marker = Map.drawSVGMarker(data.dot.lat, data.dot.lng, "client", data.name, "", client.deploy_information.deployed, self.getClientColor(client), borderColor);
    							   // Define draggable or not, depending on the user level
    							   if((LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_TECNICO]) || 
                					LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR]))
									&& !client.deploy_information.deployed){
    								   client.marker.draggable = true;
    							   } else {
    								   client.marker.draggable = false;
    							   }
    							   // Add Listener
    							   Map.addListenerClient(client);
    							   
    							   // Set map
    							   //comentada pq a função addClientTreeView faz isso qdo executa check_node 
    							   $rootScope.Markers.addToMap(client.marker, $rootScope.Markers.clientsMarkerCluster); 
    							   
    							   // Add to the treeview
        						   //self.addClientTreeView(data.id, data.name, self.clients.length - 1);
    						   }
    						   //Insert in the list
    						   self.clients.push(client);
    						   if(!self.editing){
    						   		self.addClientTreeView(data.id, data.name, self.clients.length - 1);
    							}
    						   self.isLoading = false;
	        			   }
	        			   self.editing = false;
	        		   } else {
	        			   self.isLoading = false;
	        		   }
	        	   },
	        	   complete:function(){
	        		   if($rootScope.menuMap){
	        			   $rootScope.menuMap = false;       
	        			   $rootScope.dialogService.close("menuMap");
	        		   }
	        		   self.block_dbclick_add_client = false;
	        		   if (last_kmz_point){
	        			   $rootScope.message_success = $rootScope.Users.translateText("Todos os itens KMZ foram importados");
	        			   setTimeout(function() {
	        				   $rootScope.message_success = "";
	        			   }, 4000);
	        			   Map.isLoading = false;
	        			   $rootScope.last_kmz_point = false;
	        		   }
	        		   $rootScope.form.name = $rootScope.Users.translateText("Cliente de nome indefinido"); 
	        	   }
	           });
	           
	           return created_entity;
           },

	       
	      blink : function(client, start){
	    	  self.clientBlinking = client;
	    	  if (start){
	    		  $rootScope.Markers.removeFromMap(client.marker, $rootScope.Markers.clientsMarkerCluster);
	    		  self.blinkInterval = $interval(function() {
	    			  if (client.marker.map) {
	    				  client.marker.setMap(null);
	    			  } else {
	    				  client.marker.setMap(Map.map);
	    			  }
                  }, 300);
              }else{
                   $interval.cancel(self.blinkInterval);
                   client.marker.setMap(null);
                   $rootScope.Markers.addToMap(client.marker, $rootScope.Markers.clientsMarkerCluster);
	    	  }
	      },
	       
	      list : function(flag){

	    	  self.isLoading = true;
	    	  link = $rootScope.base_url+"/clients/list_all";
	    	  $.ajax({
	    		  url: link,
	    		  type: "POST",
	    		  success:function(data){
					  clients = [];
					  
					  // Onus weren't loaded yet, so the client
					  // signal colors should be set afterwards
					  if (!$rootScope.onus){
						$rootScope.Onus.setSignalsOnClients = true;
					  }

					  for (var j = 0; j < self.clients.length; j++){
						//val.marker.setMap(null);  
						val = self.clients[j];
						$rootScope.Markers.removeFromMap(val.marker, $rootScope.Markers.clientsMarkerCluster);
						};
						self.clients = [];
						if(data.length > 0){
							//angular.forEach(data,function(val,index){
							for (var i = 0; i < data.length; i++){
								var val = data[i];								
								var client = val;
								var borderColor = self.getClientBorder(val);
								client.deploy_information = val.deploy_information;
								if (val.dot){
									var description = (typeof val.last_signal !== "undefined") ? "Nível do sinal: " + val.last_signal + "dB" : "";
									client.marker = Map.drawSVGMarker(val.dot.lat, val.dot.lng, "client", val.name, description, client.deploy_information.deployed, self.getClientColor(client), borderColor);
								}

								// Define se cliente é arrastável ou não
								if (client.marker){
									if((LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_TECNICO]) || 
										LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR]))
										&& !client.deploy_information.deployed){
										client.marker.draggable = true;
									} else {
										client.marker.draggable = false;
									}
									Map.addListenerClient(client);
								}
								if(flag){
									$rootScope.Markers.addToMap(client.marker, $rootScope.Markers.clientsMarkerCluster);
									self.viewClients = true;
								};

								if(client.drop_cable_id){
									client.drop_type_index = 4;
					                client.drop_index = client.drop_cable_id;
								}
								
								clients.push(client);
							};
						}

						self.isLoading = false;
						self.clients = clients;
						//After listing all, notify treeview nodes service
						$rootScope.Nodes.everythingLoaded("Clients");
					},
					complete:function(){
						$rootScope.$apply();
					}
				});

            // @bruno - 10/01/2021 - Desabling server cache for now
	    	// Send an extra request to cache all the clients
	    	//   cache_link = $rootScope.base_url+"/clients/cache_all";
	    	//   $.ajax({
	    	// 	  url: cache_link,
	    	// 	  type: "POST",
	    	// 	  success:function(response){}
	    	//   });
		  },

		/**
		 * 
		 * @param {*} client 
		 */
		getClientColor: function (client) {
			if (!client.color) {
				// If no color is set, set default grey
				client.color = "#c0c0c0";
			}
			return client.color;
		},

		/**
		 * Define a cor da borda do cliente de acordo com o sinal da sua ONU, caso encontrado
		 * @param {*} client 
		 */
		getClientBorder: function (client) {
			
			var borderColor = "black";
			// Verifica se cliente tem serial de onu, se estamos no modo monitor, e se as onus ja foram carregadas
			if (client.serial_onu && LevelsAndModes.isMode([LevelsAndModes.modes.MODO_MONITOR]) && $rootScope.onus) {
				// Loop para buscar a ONU do cliente na lista das onus, de acordo com o serial 
				for (var x = 0; x < $rootScope.onus.length; x++) {
					if (client.serial_onu === $rootScope.onus[x].serial) {
						if ($rootScope.onus[x].onu_status != 1) {
							borderColor = "#ff0000"; //red
						} else {
							borderColor = "#17cf17"; //green
						}
						client.last_signal = $rootScope.onus[x].last_signal;
                        client.onu_status = $rootScope.onus[x].onu_status;
						break;
					}
				}
			}
			return borderColor;
		},

		/**
		 * Retrieves a client from the local list of clients
		 * based on its id
		 * @param {*} id 
		 */
		findClient : function(id){
			for (let i = 0; i < self.clients.length; i++) {
				if (self.clients[i].id === id){
					return self.clients[i];
				}
			}
			return false;
		},

		findClientIndex : function(id){
			for (let i = 0; i < self.clients.length; i++) {
				if (self.clients[i].id === id){
					return i;
				}
			}
			return -1;
		},

		organize_client_data : function(clients_data){
			clients = [];
			for (var i = 0; i < clients_data.length; i++){
				var val = clients_data[i];								
				var client = val;
				var borderColor = self.getClientBorder(val);
				client.deploy_information = val.deploy_information;
				if (val.dot){
					var description = (typeof val.last_signal !== "undefined") ? "Nível do sinal: " + val.last_signal + "dB" : "";
					client.marker = Map.drawSVGMarker(val.dot.lat, val.dot.lng, "client", val.name, description, client.deploy_information.deployed, self.getClientColor(client), borderColor);
				}

				// Define se cliente é arrastável ou não
				if (client.marker){
					if((LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_TECNICO]) || 
						LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR]))
						&& !client.deploy_information.deployed){
						client.marker.draggable = true;
					} else {
						client.marker.draggable = false;
					}
					if(client.sharedDatabase){
						client.marker.draggable = false;
					}
					Map.addListenerClient(client);
				}

				if(client.drop_cable_id){
					client.drop_type_index = 4;
					client.drop_index = client.drop_cable_id;
				}
				
				clients.push(client);
			};

			self.clients = self.clients.concat(clients);
		},

		redrawClient: function (id) {
			self.isLoading = true;
			var client = self.findClient(id);
			if (!client){
				return;
			}
			var index_client = self.findClientIndex(id);
			if ((client.apartment_id !== null) && !(typeof client.apartment_id === "undefined")) {
				// If its a client in a building, dont redraw it
				return;
			}

			// Check if original marker was on map. If it wasnt,
			// new marker shouldnt be shown either
			var addNewMarkerToMap = client.marker.map ? true : false;

			$rootScope.Markers.removeFromMap(client.marker, $rootScope.Markers.clientsMarkerCluster);
			client = {};
			link = $rootScope.base_url + "/clients/get";
			$.ajax({
				url: link,
				type: "POST",
				data: { id: id },
				success: function (data) {
					if (data.id) {
						var newClient = data;

						// Get border color based on client onu signal status
						var borderColor = self.getClientBorder(newClient);
						newClient.deploy_information = data.deploy_information;
						//Define marker color
						var description = (typeof data.last_signal !== "undefined") ? "Níiiivel do sinal: " + data.last_signal + "dB" : "";
						newClient.marker = Map.drawSVGMarker(data.dot.lat, data.dot.lng, "client", data.name, description, newClient.deploy_information.deployed, self.getClientColor(newClient), borderColor);

						//Define draggable or not, depending on the user level
						if ((LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_TECNICO]) ||
							LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR]))
							&& !newClient.deploy_information.deployed) {
							newClient.marker.draggable = true;
						} else {
							newClient.marker.draggable = false;
						}
						//Add Listener
						Map.addListenerClient(newClient);
						
						//Set map
						//client.marker.setMap(Map.map);
						if (addNewMarkerToMap){
							$rootScope.Markers.addToMap(newClient.marker, $rootScope.Markers.clientsMarkerCluster);
						}
						
						$rootScope.Nodes.changeNodeIcon(4, newClient);
						
						//Insert in the list
						self.clients[index_client] = newClient;
						self.isLoading = false;
					}
				}
			});

		},

          deleteClient : function(id){
        	  $rootScope.dialogService.close("menuClient");
              var options = {
                      autoOpen: false,
                      modal: true,
                      title:"Atenção",
                      width: 300,
                      height:"auto",
                      resizable:true,
                      dialogClass: "noclose", 
                 };
                 model = [];  
                 $rootScope.client_id = id;
                 $rootScope.dialogService.open("clientDelete","clientDelete", model, options).then();
                
                
          },
          
          deleteConfirm : function(id, synchronous){
        	  var async = true;
        	  var delete_connection = true;
        	  var set_errors = true;
        	  if (synchronous){
        		  async = false;
        		  delete_connection = false;
        		  set_errors = false;
        	  }
        	  $.ajax({
              	url: $rootScope.base_url+"/access_points/delete_client_fusion",
                type: "POST",
                data: {id:id},
                success:function(response){
                    // Função que remove a fusão do BD quando um cliente ativado é deletado diretamente pelo mapa             
                }
             });
                                          
        	  link = $rootScope.base_url+"/clients/delete";
        	  $.ajax({
        		  url: link,
        		  type: "POST",
        		  data: {id:id},
        		  async: async,
        		  success:function(data){
        		  	var deletingClientBuilding = false;
        		  	
        			  if ($rootScope.Buildings.deleting_client){
						deletingClientBuilding = true;
    					  $rootScope.set_errors_modal(data,"buildingClientDelete");
    				  }
        			  if (set_errors){
        				  $rootScope.set_errors_modal(data,"clientDelete");
        			  }
        			  if(data.status == 1){
        				  //Remove client drop cable, and client connection in ap
        				  var i;
        				  for (i = 0; i < self.clients.length; i++){
        					  if (self.clients[i].id == id){
        						  var client_del = self.clients[i];
        					  }
        				  }
        				  if (client_del.ap_id_connected){
        					  $rootScope.Cables.deleteDropCable(client_del.drop_cable_id);
        					  if (delete_connection){
        						  $rootScope.Connections.deleteClientConnAp(client_del.id, client_del.ap_id_connected);
        					  }
        				  }
        				  //Delete client marker, and client var in angular
        				  angular.forEach(self.clients, function(client, index_client){
        					  if (client.id == id){
        						  if (!deletingClientBuilding){
        						  	//Por algum motivo só remove imediatamente com essa declaração duplicada
        							  $rootScope.Markers.removeFromMap(client.marker, $rootScope.Markers.clientsMarkerCluster);
        						  }
        						  self.clients.splice(index_client,1);
        					  }
        				  });
        				  //Remove client from treeview
        				  if (!deletingClientBuilding){
        					  self.removeClientFromTreeView(id);
        				  }
        			  }
        		  },
        		  complete:function(){
        		  	$rootScope.$apply();
        		  }
        	  });  
          },

          findFusionClient : function(id){
          	 fusion = false;
            var d = $q.defer();
            id_fusion = false;
            data = slot.id.split("_");
            conn_id =  data[0];
            fiber  = data[1];            
            //rodar todas as fusions e encotrar a qual tem a fibra x e a connection x para pedar o id da fusion
            angular.forEach($rootScope.Connections.connections.fusions, function(el,index){
                if(el){
                    if(el.access_point_connection_id_in == conn_id && el.fiber_in == fiber){
                        fusion = el;
                    }
                    if(el.access_point_connection_id_out == conn_id && el.fiber_out == fiber){
                        fusion = el;
                    }
                    if(fusion){
                        d.resolve(fusion);
                    }
                }
            });    
            

            return d.promise;    
          },
          
          deploy : function(id, new_status){
        	  angular.forEach(self.clients, function(current_client, intex_client){
        		  if (current_client.id == id){
        			  client = current_client;
        		  }
        	  });
        	  if(new_status === undefined) {
                  if(client.deploy_information.deployed){
                      deploy = 0;
                  }else{
                      deploy = 1;
                  }
        	  } else {
        		  if (new_status == client.deploy_information.deployed){
        			  return;
        		  } else {
        			  deploy = new_status;
        		  }
        	  }
        	  
              self.isLoading = true;
              $.ajax({
                  url: $rootScope.base_url+"/clients/deploy",
                  type: "POST",
                  data: {id:client.id,deployed:deploy},
                  success:function(data){            
                      if(data.status == 0){
                          var options = {
                              autoOpen: false,
                              modal: true,
                              title: $rootScope.Users.translateText("Atenção"),
                              width: 300,
                              height:"auto",
                              resizable:true,
                              dialogClass: "noclose", 
                          };
                          $rootScope.messageAlert = "<h6>"+data.message+"</h6>";
                          model = [];  
                      }else{
						self.redrawClient(client.id);
                      }
                  },
                  complete:function(){
                      self.isLoading = false;
                      if (self.menuClient){
                    	  self.menuClient = false;  
                    	  dialogService.close("menuClient");
                      }
                      $rootScope.$digest();
                  }
              });
        },
          
        edit : function(id){
        	      	
			var options = {
				autoOpen: false,
				modal: true,
				title: $rootScope.Users.translateText("Editar cliente"),
				width: 400,
				height:"auto",
				resizable:true,
				dialogClass: "noclose",
        		close:function(){
        			self.editing = false;   
        			$rootScope.form = [];

        			if(self.bulkEdit){
						self.bulkEdit = false;
                        self.bulkDeploy = false;
						self.bulkUndeploy = false;
                        $rootScope.dotsCount = $rootScope.dotsTemp.length;
					}

					$rootScope.message_error_modal = "";
					self.searchAddress = false;

        		} 
			};
			model = [];
			$rootScope.form = [];
			$rootScope.form.error = [];

			if(!self.bulkEdit){
				angular.forEach(self.clients, function(cliente, index){
					if (cliente.id == id){
						client = cliente;
					}
				}); 

				$rootScope.form.name = client.name;
				$rootScope.form.id = client.id;
				$rootScope.form.serial = client.serial_onu;
				$rootScope.form.color = client.color;
				$rootScope.form.lat = client.dot.lat;
				$rootScope.form.lng = client.dot.lng;
				self.editing = true;
			}else{
				$rootScope.Nodes.getTreeViewFolders();
			}
			
			if($rootScope.dialogService.isOpen("menuClient")){
				$rootScope.dialogService.close("menuClient");
			}
			$rootScope.dialogService.open("clientAdd","clientAdd", model, options).then(function() {
				setTimeout(function() {
				  $("#select-folder-client").selectize();
				}, 1000);
			});

		},

		bulkEditConfirm : function(){

			self.isLoading = true;
			$rootScope.$evalAsync();

			var clients = $rootScope.Clients.clients.filter(obj =>  obj.dot && google.maps.geometry.poly.containsLocation(obj.marker.position, $rootScope.shapeTemp));
            
            if(clients.length === 0){
            	$rootScope.message_error_modal = $rootScope.Users.translateText("Tipo não encontrado");
				self.isLoading = false;
				return;
			}
			
			var arrItems = {};
			var contIndex = 0;

			clients.forEach(client =>{

				//verifica se o item está visivel
				if(!$rootScope.Markers.markerOnMap(client.marker)){
					return;
				}

				$rootScope.form.error = [];
				var item = {};

				if ($rootScope.form.name){
				    item.name = $rootScope.form.name;
				    client.name = $rootScope.form.name;
				}

				if ($rootScope.form.serial){
				    item.serial_onu = $rootScope.form.serial;
				    client.serial_onu = $rootScope.form.serial;
				}

				if ($rootScope.form.color){  
				    item.color = $rootScope.form.color;
				    client.color = $rootScope.form.color;
				}

				item.changeDeployed = false;
                
                //deploys
                if(self.bulkUndeploy && client.deploy_information.deployed){
					item.changeDeployed = true;
					item.deployed = false;
					client.deploy_information.deployed = false;
				}else if(self.bulkDeploy && !client.deploy_information.deployed){
					item.changeDeployed = true;
					item.deployed = true;
					client.deploy_information.deployed = true;
				}

				item.changeFolder = false;

				if ($('#select-folder-client').val()){
					
					var node = [];
					
					if(node = $rootScope.Nodes.nodes.find(n=>n.client_id === client.id)){
						item.node_id = node.id;
						item.parent_id = parseInt($('#select-folder-client').val());
	                    item.changeFolder = true;
					}					
                    
                }

				item.id = client.id;

				arrItems[contIndex] = item;
				contIndex++;
        
			});
			
			edit_many(arrItems);

            function edit_many(items) {
				self.isLoading = true;
				var dataSend = JSON.stringify(items);          
				$.ajax({
					url: $rootScope.base_url+"/clients/edit_many",
					type: "POST",
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
		 * See ERP Info
		 * Called from client conext menu
		 * 
		 * Opens a modal to show ERP Information of this client, if it's integrated
		 * 
		 * @param {object} client 
		 */
		seeErpInfo : function(client){
			// Don't show anything if client isn't integrated
			if (!client.erp_integrated_flag){
				return;
			}

			// Make ajax call to get erp client info
			$.ajax({
                url: $rootScope.base_url+"/clients/get_erp_info",
                type: "POST",
                data: {id: client.id},
                success:function(data){
					self.selectedClientErpInfo = JSON.parse(data.erp_info);
					console.log(self.selectedClientErpInfo);

					// Render toggable list in the container element
					renderjson.set_show_to_level(1);
					document.getElementById("client-erp-details-data-container").appendChild(
						renderjson(self.selectedClientErpInfo)
					);
                },
                complete:function(){
                     $rootScope.$apply();
                }
           });

			// Open Modal: clientErpDetails
			var options = {
				autoOpen: false,
				modal: true,
				title: $rootScope.Users.translateText("Dados do cliente no ERP"),
				width: 450,
				height: 500,
				resizable:true,
				close: function(){
					console.log("Removing ERP info data");
					self.selectedClientErpInfo = null;
				}
			};
			model = [];
			$rootScope.dialogService.open("clientErpDetails","clientErpDetails", model, options).then();
		},
        
        setConnected : function(id, ap_id_connected){
        	link = $rootScope.base_url+"/clients/edit";
        	data = {};
            data.id = id;
        	data.ap_id_connected = ap_id_connected;
        	$.ajax({
                url: link,
                type: "POST",
                data: data,
                success:function(data){
                    if(data.status == 1){
						// Set local client to connected
						for (let index = 0; index < self.clients.length; index++) {
							var current_client = self.clients[index];
							if (current_client.id === id){
								current_client.ap_id_connected = ap_id_connected;
							}
						}
                    }
                },
                complete:function(){
                     $rootScope.$apply();
                }
           });
        },
        
        setNotConnected : function(id){
        	link = $rootScope.base_url+"/clients/edit";
        	data = {};
            data.id = id;
        	data.ap_id_connected = null;
        	$.ajax({
                url: link,
                type: "POST",
                data: data,
                success:function(data){
                    if(data.status == 1){
						for (i = 0; i < self.clients.length; i++){
							if (self.clients[i].id == id){
								self.clients[i].ap_id_connected = null;
							}
						}
                    	//self.redrawClient(id);
                    }
                },
                complete:function(){
                     $rootScope.$apply();
                }
           });
        },

        // --- ROUTERS --- //
        
        listRouterTypes : function(){
            link = $rootScope.base_url+"/router_types/list_all";
            $.ajax({
                 url: link,
                 type: "POST",
                 success:function(data){
                	 self.routerTypes = data;
                 },
            });
        },
        
        addRouter : function(){
	        var options = {
	             autoOpen: false,
	             modal: true,
	             title: $rootScope.Users.translateText("Adicionar Cliente"),
	             width: 300,
	             height:"auto",
	             resizable:true,
	             dialogClass: "noclose", 
	        };
	        model = [];  
	        self.adding = true;
	        $rootScope.form = [];
	        $rootScope.form.error = [];
	        if($rootScope.menuMap){
                 $rootScope.menuMap = false;       
                 $rootScope.dialogService.close("menuMap");
            } else if($rootScope.menuCable){
                 $rootScope.menuCable = false;       
                 $rootScope.dialogService.close("menuCable");
            }
	        $rootScope.dialogService.open("clientAdd","clientAdd", model, options).then();
        },
        
        addRouterConfirm : function(){
        	
        },
        
		addClientTreeView : function(id, name, tomo_index){
			node_data = {};
			node_data.parent_id = $rootScope.Nodes.saving_node_id;
			node_data.leaf = 1;
			node_data.selected = 1;
			node_data.checked = 1;
			node_data.category = 4;
			node_data.client_id = id;
			
			var tomo_node_id = $rootScope.Nodes.addSync(node_data);
			
			var icon = $rootScope.base_url + "/img/icons_map/cliente_cad.svg";
			$rootScope.Nodes.addNoteToTree(id, tomo_node_id, $rootScope.Nodes.saving_node_id, icon, name, 4, tomo_index);
		},
		
		removeClientFromTreeView : function(client_id){
			//Remove node from DB
			var remove_node_id = null;
			var i;

			for (i = 0; i < $rootScope.Nodes.nodes.length; i++){
				if ($rootScope.Nodes.nodes[i].client){
					if ($rootScope.Nodes.nodes[i].client_id == client_id){
						remove_node_id = $rootScope.Nodes.nodes[i].id;
					}
				}else if($rootScope.Nodes.nodes[i].data){ //se o cliente for deletado logo após ter sido criado
					if ($rootScope.Nodes.nodes[i].data.client_id == client_id){
						remove_node_id = $rootScope.Nodes.nodes[i].data.id;
					}
				}
			}
			var data = {};
			data.id = remove_node_id;
			//Remove drom tree view
			$rootScope.Nodes.deleteNodeFromTree(remove_node_id);
			//Remove node from DB
			//$rootScope.Nodes.deleteNode(data); //comentada pq a função deleteNodeFromTree executa deleteNode também
		},
		
		/**
		 * 
		 * 1 - 	Sets the drop cable type and drop cable index (each in its array).
		 * 		These indexes are used by the treeview to show/hide drop cables according to the client.
		 * 2 - 	If client doesn't have a drop_cable_id yet, stores the id in the database. This usually
		 * 		only happens to clients that are just being connected, but is useful to update databases
		 * 		where the clients don't have a reference to the drop cable yet.
		 * 
		 * @param {number} client_id 
		 * @param {number} cable_id 
		 * @param {number} cable_type_index 
		 * @param {number} cable_index 
		 */
		setClientCable : function(client_id, cable_id, cable_type_index, cable_index){
			var i;
			for (i = 0; i < self.clients.length; i++){
				if (self.clients[i].id == client_id){
					if (self.clients[i].drop_cable_id === null || typeof self.clients[i].drop_cable_id === "undefined"){
						self.clients[i].drop_cable_id = cable_id;
						self.setClientDropCableId(client_id, cable_id);
					}
					self.clients[i].drop_type_index = cable_type_index;
					self.clients[i].drop_index = cable_index;
					break;
				}
			}
		},

		/**
		 * Saves the client drop cable id to the database
		 * 
		 * @param {number} client_id 
		 * @param {number} cable_id 
		 */
		setClientDropCableId : function(client_id, cable_id){
			var dataSend = {};
			dataSend.id = client_id;
			dataSend.drop_cable_id = cable_id;
			link = $rootScope.base_url+"/clients/edit";
			$.ajax({
				url: link,
				type: "POST",
				data: dataSend,
				success:function(data){}
			});
		},

		rename : function(id,new_name){

				var dataSend = {};
				dataSend.id = id;
				dataSend.name = new_name;
		
				link = $rootScope.base_url+"/clients/edit";
					
				$.ajax({
						url: link,
						type: "POST",
						data: dataSend,
						success:function(data){
							for (var i = 0; i < $rootScope.Clients.clients.length; i++){
								if($rootScope.Clients.clients[i].id === id){
									$rootScope.Markers.removeFromMap($rootScope.Clients.clients[i].marker, $rootScope.Markers.clientsMarkerCluster);
									$rootScope.Clients.clients[i].marker.title = new_name;
									$rootScope.Markers.addToMap($rootScope.Clients.clients[i].marker, $rootScope.Markers.clientsMarkerCluster);
									$rootScope.$apply();
								}
							}
						}});
		
			},
		
		getClient : function(client_id){
			var i;
			for (i = 0; i < self.clients.length; i++){
				if (self.clients[i].id == client_id){
					return self.clients[i];
				}
			}
		},
		
		getLatLngByAddress : function(e){
			$rootScope.message_error_modal = "";
			// pressed enter - start search
			var geometry = null;
			// Request to backend to get location
			var dataSend = {};
			dataSend.textSearch = $rootScope.form.address;
			link = $rootScope.base_url + "/maps/get_location_text",
			$.ajax({
				url: link,
				data: dataSend,
				type: "POST",
				success: function (data) {
					if (data.data && data.status === 1){
						geometry = data.data;

						viewLocation(geometry);

						$rootScope.form.lat = geometry.location.lat;
						$rootScope.form.lng = geometry.location.lng;

						self.searchAddress = false;

					} else {
						$rootScope.message_error_modal = "Endereço não encontrado";
					}

					$rootScope.$apply();
				}
			});

			function viewLocation(geometry){

				var locationMap = Map.map;
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

			}
		},

		/**
		 * Reload client signal
		 * 
		 * Reloads all ONUs signals, and checks if the signal has changed for any client.
		 * If any client has changed, redraw that client.
		 */
		reloadClientSignal : function(){
			$.ajax({
				url: $rootScope.base_url+"/Onus/list_all",
				type: "POST",
				success:function(data){
					//Verifica se houve alteracao no sinal e redesenha icone do cliente
					for (var i = 0; i < data.length; i++){
						for (var j = 0; j < $rootScope.onus.length; j++){
							// TODO This checks the last signal in the ONU. Should check client as well
							if ((data[i].id === $rootScope.onus[j].id) && (data[i].last_signal != $rootScope.onus[j].last_signal)){
								for (var x = 0; x < $rootScope.Clients.clients.length; x++){
									if (($rootScope.Clients.clients[x].serial_onu === data[i].serial) && ($rootScope.Clients.clients[x].last_signal != data[i].last_signal)){
										
										$rootScope.Clients.clients[x].last_signal = data[i].last_signal;
										$rootScope.onus[j].last_signal = data[i].last_signal;
										
										$rootScope.Clients.redrawClient($rootScope.Clients.clients[x].id);
										$rootScope.$apply();
										break;
									}
								}

								break;
							}
						}
					}
				}
		   });
		},
	};
	
	return self;
});