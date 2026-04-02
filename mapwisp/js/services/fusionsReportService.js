app.service('FusionsReport', function ($rootScope,Map,Projects,dialogService,$q,Cables,$document,$timeout,$window) {
		
		var self = {
			isloading : false,
			route : [],

			fusionInAp : function(fusion, ap){
				for (i = 0; i < ap.fusions.length; i++){
					if (ap.fusions[i].id == fusion.id){
						return true;
					}
				}
				return false;
			},
			
			cpReportObj : function(obj){
				return_array = [];
				return_array['access_points'] = obj.access_points.slice(0);
				return_array['dots'] = obj.dots.slice(0);
				return_array['fusions'] = obj.fusions.slice(0);
				return_array['splitters'] = obj.splitters.slice(0);
				return_array['host_port'] = obj.host_port;
				return_array['active'] = obj.active;
				if (obj.active){
					return_array['loss'] = obj.loss;
					return_array['signal_power'] = obj.signal_power;
				}
				return return_array;
			},
			
			
	        requestReport : function(slot,newWindow,fromNewWindow,document_root, otdr, meters, last_item, sumCEOReserve){
	        	if(newWindow){
	        		//chamar função que escreva a msg de cada item pra mosta na tela
	        		if (otdr){
	        			meters = $rootScope.form.meters;
                        let sumAutoReserveOnCEO = $rootScope.form.autoReserveType === "ceo";
                        console.log("sumAutoReserveOnCEO", sumAutoReserveOnCEO);
	        			//to be used in the new window
	        			$window.newWindowSlot = slot;
	        			$window.open($rootScope.base_url+'/maps/fiber_report_map?connection_id='+slot.connection_id+'&fiber_number='+slot.fiber+'&access_point_id='+ $rootScope.Connections.accessPointOpened.id+'&otdr='+otdr+'&meters='+meters+'&sumCEOReserve='+sumAutoReserveOnCEO,'MAPWISP - OTDR',"height=800,width=1000")
	        			$rootScope.dialogService.cancel('requestOtdr');
	        		} else {
	        			//to be used in the new window
	        			$window.newWindowSlot = slot;
	        			$window.open($rootScope.base_url+'/maps/fiber_report_map?report_data='+slot.report_data+'&connection_id='+slot.connection_id+'&fiber_number='+slot.fiber+'&access_point_id='+ $rootScope.Connections.accessPointOpened.id,'MAPWISP - Rota da fibra',"height=800,width=1000")
	        		}
	        		self.route = [];
	        	}else{
	        		if (last_item){
	        			response = self.cpReportObj(slot.report_data);
	        		} else{
		        		if(!fromNewWindow){
			        		$rootScope.Fusions.checkSlotReport(slot,2);
			        		access_point_open_id = $rootScope.Connections.accessPointOpened.id;
			        		link = $rootScope.base_url+'/maps/fiber_report';
			        		fiber = slot.fiber
				            //response is the variable used to hold the report data
				            //some data is deleted in 'respose' for the report to work properly, so a copy by value is made
				            //in order to maintain the original slot.report_data intact, for further use.
			        		response = self.cpReportObj(slot.report_data);
			        	}else{
			        		access_point_open_id = slot.access_point_id;
			        		link = $rootScope.base_url+'/fiber_report';
			        		fiber = slot.fiber_number;
			        		response = self.cpReportObj($window.opener.newWindowSlot.report_data);
			        		$window.opener.newWindowSlot = null;
			        	}
		        	}
		            self.route = [];
		            angular.forEach(response.dots,function(dot,index_dot){
                		//se realmente tiver um ap no ponto
                		if(dot){
                    		data = [];
                    		data.splitters = []
                    		data.fusions = []
							data.trays = []
                    		data.dot = dot;
                            for (i = 0; i < response.access_points.length; i++){
                            	ap = response.access_points[i];
                            	if(ap){if(dot.id == ap.dot_id){ 
                                	data.access_point = ap;

                                	//Se tiver um splitter no AP atual, e a fibra atual passar por ele, adiciona no passo atual
                                	angular.forEach(ap.splitters, function(splitter, index_splitter){
                                		data.splitters.push(splitter);
                                	})  

                                	//Para cada fusao no AP atual, adicione no passo atual
                                	angular.forEach(ap.fusions, function(fusion, index_fusion){
                                		data.fusions.push(fusion);
                                	})

									//Para cada fusao no AP atual, adicione no passo atual
                                	angular.forEach(ap.trays, function(tray, index_tray){
                                		data.trays.push(tray);
                                	})
   
	                                if(response.host_port){
	                                	if (data.access_point.host_port != null){
	                                    	angular.forEach(data.access_point.access_point_connections,function(conn,index_conn){
	                                        	if(conn.id == response.host_port.connection_id){// && (response.host_port.id == data.access_point.host_port.id)){
	                                        		data.access_point.access_point_connections[index_conn]['host_port'] = response.host_port;
	                                        	}
	                                    	});  
	                                	}
                                    }
                                    delete response.access_points[i];
                                    break;
                                }}
                            }
                            self.route.push(data);   
                        } 
                    });
					if(response.active){
                    	self.route.active = true;
                        self.route.loss = response.loss;
                        self.route.signal_power = response.signal_power;
                    }
                 	if(response.loop){
                    	self.route.loop = true;
                    }
					self.writeReportLog(self.route,fromNewWindow).then(function(reportLog){
						
						if (last_item){
							if ($rootScope.showingPowerDiv){
								$rootScope.showingPowerDiv = false;
							} else {
								$rootScope.Fusions.attachLastItemReport(slot,reportLog[reportLog.length-1]);
							}
						} else{
							if(!fromNewWindow){
								$rootScope.Fusions.attachReport(slot,reportLog).then(function(){
									$rootScope.Fusions.checkSlotReport(slot,1);																										
								});					
							}else{
								if (otdr){
									self.drawReportOnMap(reportLog,response.active,document_root, otdr, meters, sumCEOReserve).then(function(){
										// $rootScope.Fusions.checkSlotReport(slot,1);																										
									});	
								} else {
									self.drawReportOnMap(reportLog,response.active,document_root).then(function(){
										// $rootScope.Fusions.checkSlotReport(slot,1);																										
									});		
								}
							}	
						}
						// Se apVisualizer estiver aberto, 
						// retorna o relatório pra ser exibido
						if(!$rootScope.Connections.originalApShow){
							reportLog.signal_power = response.signal_power;
							$rootScope.apVisualizer.setSlotReportLog(slot.id,reportLog)
						}
					})                          
		                             
				}	                
	        },     


	        writeReportLog : function(route,fromNewWindow){
	        	var d = $q.defer();	        	
	        	var logs = [];
	        	var diologs = [];
	        	var response = {};
				var legthPath = [];
				var push = true;
				var dioPush = false;

				var sumReserve = 0;
				var current_fiber = null; // Será atualizada com a última fibra usada nas fusões
				var current_cable_name = null; // Armazena o nome do último cabo usado

	        	//sufixo da imagem
	        	if(route.active){
	        		img_sfx = '_active';
	        	}else{
	        		img_sfx = '';
	        	}
	        	angular.forEach(route, function(rt, index){
					//montar log com mensagem , id do ap e imagem para o report de cada	ponto que a fibra passou
					log = [];					
					dioLog = [];					
					
					legthPath.push(new google.maps.LatLng(rt.dot.lat, rt.dot.lng));
					//usar os dots para calcular a distancia da fibra
					if(legthPath.length == 1){
						distance = 0;
					}else{						
						distance = Map.calculateLengthObject(legthPath);
					}

					if(rt.dot.cable_reserves && rt.dot.cable_reserves.length > 0){
						sumReserve += rt.dot.cable_reserves[0].length;
					}
							
                    log.distance = distance;

					log.access_point = [];
					if(rt.access_point){

						//Soma tamanho da reserva na distância
						if(sumReserve){							
							distance = (parseFloat(distance) + sumReserve).toString();								
						}
						
						log.dot = rt.dot;					
						log.access_point.name = rt.access_point.name;
						log.access_point.id = rt.access_point.id;
						log.access_point.category = rt.access_point.category;
						if (rt.access_point.dio_tray) { log.access_point.dio_tray = rt.access_point.dio_tray; }
						if (rt.access_point.dio_port) { log.access_point.dio_port = rt.access_point.dio_port; }
						
						if(index == 0){
							log.message = $rootScope.Users.translateText('Sai do Ponto de acesso atual:')+rt.access_point.name+$rootScope.Users.translateText(' - Distância : ')+distance+'m';
							log.icon = 'start_ap'+img_sfx+'.png';
							logs.push(log);
							
							log = [];
						}else{
							if(rt.fusions.length > 0 ){
								//Array to store the splitters that were wrote, in order to block repeated splitters
								wrote_splitters = [];
								angular.forEach(rt.fusions, function(fs,index_fusion){
									push = true;
									dioPush = false;
									fiber_in = fs.fiber_in;
									fiber_out = fs.fiber_out;

								
									// log.fusion = fs;									
									msg = $rootScope.Users.translateText('Ponto de acesso: ')+rt.access_point.name+'. ';
									
									if(fs.connection_type == 0){
										msg += $rootScope.Users.translateText('Passagem entre ');
									}else{
										msg += $rootScope.Users.translateText('Fusão entre ');
									}

									
									connIn = self.findConnectionRoute(rt.access_point, fs.access_point_connection_id_in);
									if(connIn.cable_id != null){
										msg += $rootScope.Users.translateText('o cabo: ')+connIn.cable.name + $rootScope.Users.translateText(' [fibra ') + fiber_in + '] ';
										log.icon = 'cable_report'+img_sfx+'.png';

										current_cable_name = connIn.cable.name;

										// Atualiza a fibra e cabo atuais para o próximo ponto
										current_fiber = fiber_in;

										self.getTrayConnected(connIn,fiber_in);
										if(connIn.tray_connected){
											dioPush = true;

											dioLog.message = $rootScope.Users.translateText('Passagem na ') + 
											$rootScope.Users.translateText('Bandeja: ') + connIn.tray_connected.name +
											$rootScope.Users.translateText(' no Dio: ') + connIn.dio.name;

											dioLog.icon = 'tray'+img_sfx+'.png';

											//Adiciona informações para abrir o dio ao clicar
											dioLog.dio = connIn.dio;
											dioLog.dot = rt.dot;
											
										}
										
									}else{
										if (self.wroteSplitterAlready(wrote_splitters, connIn)){
											push = false;
										}
										wrote_splitters.push(connIn);
										msg += $rootScope.Users.translateText('o splitter: ')+ connIn.splitter.name +$rootScope.Users.translateText(' [fibra ') + fiber_in + '] ';
										log.icon = 'splitter_report'+img_sfx+'.png';	
									}
									// log.message += msg;
									

									connOut = self.findConnectionRoute(rt.access_point, fs.access_point_connection_id_out);
									if(connOut.cable_id != null){
										// Armazena o nome do cabo de saída para usar em access points sem fusão
										current_cable_name = connOut.cable.name;
										// Atualiza a fibra e cabo atuais para o próximo ponto
										current_fiber = fiber_out;

										msg += $rootScope.Users.translateText('e o cabo: ')+connOut.cable.name + $rootScope.Users.translateText(' [fibra ') + fiber_out + '] ';
										log.icon = 'cable_report'+img_sfx+'.png';

										//Pega a bandeja se estiver conectado em uma
										//Adiciona o icone da bandeja e o dio em que está conectado
										self.getTrayConnected(connOut,fiber_out);
										if(connOut.tray_connected){
											dioPush = true;

											dioLog.message = $rootScope.Users.translateText('Passagem na ') + 
											$rootScope.Users.translateText('Bandeja: ') + connOut.tray_connected.name +
											$rootScope.Users.translateText(' no Dio: ') + connOut.dio.name;

											dioLog.icon = 'tray'+img_sfx+'.png';

											//Adiciona informações para abrir o dio ao clicar
											dioLog.dio = connOut.dio;
											dioLog.dot = rt.dot;
											
										}

									}else{
										if (self.wroteSplitterAlready(wrote_splitters, connOut)){
											push = false;
										}
										wrote_splitters.push(connOut);
										log.icon = 'splitter_report'+img_sfx+'.png';
										msg += $rootScope.Users.translateText('e o splitter: ')+ connOut.splitter.name + $rootScope.Users.translateText(' [fibra ') + fiber_out + '] ';
									}

									msg+= $rootScope.Users.translateText('- Distância: ')+distance+'m';									
									log.message = msg;
									if (push){
										logs.push(log);
									}

									if (dioPush){
										
										logs.push(dioLog);
									}
								})	
							} else {

								let dioLog = [];
								dioPush = false;

								if(!jQuery.isEmptyObject(rt.access_point.dio_tray)){

									dioPush = true;

									dioLog.message = $rootScope.Users.translateText('Passagem na ') + 
									$rootScope.Users.translateText('Bandeja: ') + rt.access_point.dio_tray.name;

									dioLog.icon = 'tray'+img_sfx+'.png';

									//Adiciona informações para abrir o dio ao clicar
									dioLog.dio = rt.access_point.dio_tray.dio;
									dioLog.dot = rt.dot;
									
								}

								if(!jQuery.isEmptyObject(rt.access_point.dio_port)){
									dioPush = true;

									if (dioLog.message) {
										dioLog.message += $rootScope.Users.translateText(' e conectada à porta ')+rt.access_point.dio_port.port_name+$rootScope.Users.translateText(' do Dio ')+rt.access_point.dio_port.dio.name;
									} else {
										dioLog.message = $rootScope.Users.translateText('Conectada à porta ')+rt.access_point.dio_port.port_name+$rootScope.Users.translateText(' do Dio ')+rt.access_point.dio_port.dio.name;
									}
									
									dioLog.dio = rt.access_point.dio_port.dio;
									dioLog.dot = rt.dot;
									// Ícone quando só tem dio_port (sem bandeja), evita ícone quebrado no tray
									if (!dioLog.icon) {
										dioLog.icon = 'tray'+img_sfx+'.png';
									}
								}

								if (dioPush){
									
									logs.push(dioLog);
								}
								
								msg = $rootScope.Users.translateText('Ponto de acesso: ')+rt.access_point.name+'. ';
								// Adiciona o cabo e fibra se disponíveis
								if(current_cable_name && current_fiber) {
									msg += $rootScope.Users.translateText('Cabo: ') + current_cable_name + $rootScope.Users.translateText(' [fibra ') + current_fiber + '] ';
								}
								msg+= $rootScope.Users.translateText('- Distância: ')+distance+'m';									
								log.icon = 'cable_report'+img_sfx+'.png';
								log.message = msg;
								if (push){
									logs.push(log);
								}
								
							}
						}	
					}else{
						if(fromNewWindow){
							log.dot = rt.dot;	
							logs.push(log);
						}
					}							
        		})

				if(route.active){
					var additional_loss_computed = false;
					angular.forEach(route, function(rt,index_route){
						if(rt.access_point){
							angular.forEach(rt.access_point.access_point_connections,function(conn,index){
								if(conn.host_port){											
									
									legthPath.push(new google.maps.LatLng(rt.dot.lat, rt.dot.lng));
									distance = Map.calculateLengthObject(legthPath);
									
									//Adicionar perda causada pelo proprio cabo, de acordo com a distancia
									if (conn.host_port.port_information.wavelength == 1){
										loss_km = $rootScope.DefaultValues.loss_km_1;
									} else if (conn.host_port.port_information.wavelength == 2){
										loss_km = $rootScope.DefaultValues.loss_km_2;
									} else if (conn.host_port.port_information.wavelength == 3){
										loss_km = $rootScope.DefaultValues.loss_km_3;
									} else if (conn.host_port.port_information.wavelength == 4){
										loss_km = $rootScope.DefaultValues.loss_km_4;
									} else {
										loss_km = 0.25;
									}
									cable_loss = (distance/1000) * loss_km;
									total_loss = (route.loss + cable_loss).toFixed(3);
									signal_power = (conn.host_port.port_information.power - total_loss).toFixed(3);

									log = [];
									log.access_point = [];
									log.dot = rt.dot;
									log.host = 1;
									log.distance = distance;
									log.access_point.name = rt.access_point.name;
									log.access_point.id = rt.access_point.id;
				        			log.icon = 'equip_report_active.png';
				        			if (conn.host_port.port_information.alias){
				        				port_name = '"'+conn.host_port.port_information.alias+'"';
				        			} else {
				        				port_name = conn.host_port.port_information.number;
				        			}

									let dioMsg = "";

									if (!jQuery.isEmptyObject(conn.dio) && !jQuery.isEmptyObject(conn.dio.dio_ports)) {

										let dioPort = conn.dio.dio_ports.find(p => p.connection_id === conn.id);

										dioMsg = $rootScope.Users.translateText(' Conectada à porta ')+dioPort.port_name+$rootScope.Users.translateText(' do Dio ')+conn.dio.name;
										
									}
									
				        			log.message = dioMsg+$rootScope.Users.translateText(' Conectada à porta ')+port_name+$rootScope.Users.translateText(' do equipamento ')+conn.host_port.host.name+$rootScope.Users.translateText(' - Distância: ')+distance+'m - Potência: '+signal_power+'dB';
				        			logs.push(log);
				        			//For hover over active fibers
				        			if ($rootScope.showingPowerDiv || !$rootScope.Connections.originalApShow){
				        				additional_loss_computed = true;
				        				$rootScope.Fusions.fusion_power_div = signal_power+'dB';
										if($rootScope.apVisualizer){
											$rootScope.apVisualizer.fusion_power_div = $rootScope.Fusions.fusion_power_div ;
										}
				        			}
									
								}
							})		
						}						
					});
					if ((!$rootScope.Connections.originalApShow || $rootScope.showingPowerDiv) && !additional_loss_computed){
        				$rootScope.Fusions.fusion_power_div = route.signal_power+'dB';
						if($rootScope.apVisualizer){
							$rootScope.apVisualizer.fusion_power_div = $rootScope.Fusions.fusion_power_div ;
						}
        			}
				} else {
					//Caso nao esteja ativo, ao menos fala quantos dB sao perdidos no caminho
//					log = [];
//					log.message = perda + 'dB perdidos no caminho' 
//					logs.push(log);
				}
			
				if(route.loop){
	        		log = []
        			log.icon = 'loop.png';
        			log.message = $rootScope.Users.translateText('A fibra entra em looping, verifique suas fusões');		
        			logs.push(log);
	        	}


        		d.resolve(logs);	

	        	return d.promise;			
	        	
	        },

			/* pega a bandeja na qual o cabo está conectado 
			*/
			getTrayConnected : function(conn,fiber_number){

				if(conn.dio){

					var tray_content_json = [];
					var cableType = $rootScope.Cables.cableTypes[1].find(ct=>ct.id === conn.cable.cable_type_id);
					var tubeIndex = Math.floor(fiber_number / (cableType.number_fibers / cableType.tubes)) + 1;

					angular.forEach(conn.dio.dio_trays, function(tray, indexTray){

						// Garante que tray_content_json só será parseado se não for vazio
						tray_content_json = JSON.parse(tray.tray_content_json || '{}');

						angular.forEach(tray_content_json, function(content, indexContent){

							if(content.cable_id === conn.cable_id && content.tubeIndex === tubeIndex){

								conn['tray_connected'] = tray;
								conn['tray_connected']['content'] = content;

							}

						});

					});

				}

			},

	        wroteSplitterAlready : function(spl_list, conn){
	        	wrote = false;
	        	angular.forEach(spl_list, function(spl, spl_idx){
	        		if (spl.id == conn.id){
	        			wrote = true;
	        		}
	        	});
	        	return wrote;
	        },

            findConnectionRoute : function(ap,id){          	
	            resp = false;
	            angular.forEach(ap.access_point_connections, function(conn,index){
					if(conn.id == id){
						resp = conn;
					}           	
		        });	           
	            return resp;
	        },

	        closeLastItemReport : function(slot){
	        	$rootScope.Fusions.closeLastItemReport(slot);
	        },

	        closeReport : function(slot){
	        	$rootScope.Fusions.attachReport(slot,false).then(function(){
					$rootScope.Fusions.checkSlotReport(slot,0);																										
				});	
	        },

	        drawReportOnMap : function(reportLog,active,document_root, otdr, meters, sumCEOReserve){
	        	var d = $q.defer();
	        	cablePath = [];

	        	angular.forEach(reportLog,function(log,index){ 		
	        		cablePath.push(new google.maps.LatLng(log.dot.lat, log.dot.lng));
	        		if(log.access_point){
	        			if(log.access_point.id){
	        				if(index > 0){
	        					if(!log.host){
	        						dot = self.drawMarker(log.dot.lat, log.dot.lng,'fusion.png',log.access_point.name,log.message,document_root);
	        					}else{
	        						dot = self.drawMarker(log.dot.lat, log.dot.lng,'equip.png',log.access_point.name,log.message,document_root);
	        					}
	        				}else{
	        					dot = self.drawMarker(log.dot.lat, log.dot.lng,'marker.png',log.access_point.name,log.message,document_root);
	        				}
	        				dot.setMap(Map.map);
	        			}
	        		} 
	        		if (log.dot.cable_reserves.length > 0){
	        			// Draw reserve
	        			reserve_marker = self.drawMarker(log.dot.lat, log.dot.lng, 'reserva.png', $rootScope.Users.translateText("Reserva de ") + log.dot.cable_reserves[0].length + " metros" , " ", document_root);
	        			reserve_marker.setMap(Map.map);
	        		}
	        	});	        	

	        	if(active){
	        		cor = '#0FD80A';
	        	}else{
	        		cor = '#000';
	        	}

	        	//focar no primeiro ponto do cabo
	        	Map.setCenter(reportLog[0]['dot']['lat'],reportLog[0]['dot']['lng'],10);
               
               	cable =  Map.drawPolyline(cablePath,$rootScope.Users.translateText("Rota completa da fibra"),cor); 
               	cable.setMap(Map.map);
               	
               	// If this is an OTDR call, draw a marker at the specified distance
               	if (otdr) {
               		console.log("[OTDR] Buscando ponto em " + meters + "m, sumCEOReserve:", sumCEOReserve);
               		// Get exact point on cable at distance "meters"
               		LatLng = self.findPointInCable(cable, reportLog, meters, sumCEOReserve);
               		if (LatLng == null){
               			// Fiber is not longer than 'meters' - alert it!
               			$rootScope.alert_message($rootScope.Users.translateText('<h6>O caminho da fibra é mais curto do que distância requisitada</h6>'));
               			return d.promise;
               		}

               		// Draw special marker where point at distance was found
               		icon = {
               				path: google.maps.SymbolPath.CIRCLE,
               				scale: 0,
               				special: true,
               				classe: "marcador-otdr",
               		},
               		ponto_otdr = self.drawMarker(LatLng.lat(), LatLng.lng(), icon, meters+' Metros', '', document_root);
               		ponto_otdr.setMap(Map.map);

                    $rootScope.otdrDot = {
                        lat: LatLng.lat(),
                        lng: LatLng.lng(),
                        link: "http://www.google.com/maps/place/" + LatLng.lat() + "," + LatLng.lng()
                    };
                    console.log($rootScope.otdrDot);

               		//Centralizar mapa no cabo
               		var bounds = new google.maps.LatLngBounds();
               		for (var n = 0; n < cablePath.length ; n++){
               			bounds.extend(cablePath[n]);
               		}
               		Map.map.fitBounds(bounds);
               	}
               	
               	
	        	d.resolve();

	        	return d.promise;
	        },
	        
	        /**
	         * Find Point in Cable
	         * 
	         * Finds a point in a cable at a certain distance from the beginning,
	         * taking into considerations all of the cable reserves found on the path
	         * */
	        findPointInCable : function (cable, reportLog, meters, sumCEOReserve){
	        	var auto_reserve = $rootScope.DefaultValues.auto_reserve;
	        	var total_distance = 0;
	        	var total_reserve_length = 0;
	        	for (var i = 0; i < reportLog.length; i++){

                    // Logging
                    let currentTotalStr = "||\tTOTAL: " + reportLog[i].distance + " metros.";
                    if (reportLog[i].access_point && reportLog[i].access_point.name) {
                        console.log("PASSO " + i + ": " + reportLog[i].access_point.name, currentTotalStr);
                    } else if (reportLog[i].dot.cable_reserves && reportLog[i].dot.cable_reserves.length) {
                        console.log("PASSO " + i + ": Reserva", currentTotalStr);
                    } else {
                        console.log("PASSO " + i + ": Ponto", currentTotalStr);
                    }
	        		
                    total_distance = parseFloat(reportLog[i].distance) + total_reserve_length;
	        		// If the distance traveled already surpassed the 'meters'
	        		if (total_distance > meters){
	        			LatLng = cable.GetPointAtDistance(meters - total_reserve_length);
	        			var ap = reportLog[i].access_point;
	        			var isDio = ap && (ap.dio_tray || ap.dio_port);
	        			console.log("[OTDR] Parou no passo " + i + (ap && ap.name ? " - AP: " + ap.name : "") + " - É DIO: " + (isDio ? "SIM" : "NÃO") + " | distância acumulada: " + total_distance + "m, metros solicitados: " + meters + "m");
	        			return LatLng;
	        		} else {
	        			// If the current dot has a reserve on it
	        			if (reportLog[i].dot.cable_reserves && reportLog[i].dot.cable_reserves.length > 0){
	        				total_distance += reportLog[i].dot.cable_reserves[0].length;
	        				if (total_distance > meters){
	        					LatLng = new google.maps.LatLng(reportLog[i].dot.lat, reportLog[i].dot.lng);
	        					var ap = reportLog[i].access_point;
	        					var isDio = ap && (ap.dio_tray || ap.dio_port);
	        					console.log("[OTDR] Parou no passo " + i + " (reserva)" + (ap && ap.name ? " - AP: " + ap.name : "") + " - É DIO: " + (isDio ? "SIM" : "NÃO") + " | distância acumulada: " + total_distance + "m, metros solicitados: " + meters + "m");
	        					return LatLng;
	        				} else {
	        					total_reserve_length += reportLog[i].dot.cable_reserves[0].length;
	        				}
                            console.log(" > Adicionando reserva de mapa: " + reportLog[i].dot.cable_reserves[0].length + " metros.");
	        			}
	        			
	        			// If the current dot has an access point of category 5 on it
	        			if (
                            (reportLog[i].access_point) // Current dot has an access point
                            && (
                                (reportLog[i].access_point.category == 5) // The access point is of category 5
                                || (reportLog[i].access_point.category == 4 && sumCEOReserve) // OR The access point is of category X and this option has been selected
                            ) 
                        ){
	        				total_distance += auto_reserve;
	        				if (total_distance > meters){
	        					LatLng = new google.maps.LatLng(reportLog[i].dot.lat, reportLog[i].dot.lng);
	        					var ap = reportLog[i].access_point;
	        					var isDio = ap && (ap.dio_tray || ap.dio_port);
	        					console.log("[OTDR] Parou no passo " + i + " (reserva automática)" + (ap && ap.name ? " - AP: " + ap.name : "") + " - É DIO: " + (isDio ? "SIM" : "NÃO") + " | distância acumulada: " + total_distance + "m, metros solicitados: " + meters + "m");
	        					return LatLng;
	        				} else {
	        					total_reserve_length += auto_reserve;
	        				}
                            console.log(" > Adicionando reserva automática: " + auto_reserve + " metros.");
	        			}
	        		}
	        	}
	        	return null;
	        },

            drawMarker : function (lat, lng, icon_param, name, description, link){
               var icone, mark;
               
               base_url = link.replace('/fiber_report_map','');
               if (icon_param.special){
            	   icone = {};
            	   icone.path = icon.path;
            	   icone.scale = icon.scale;
               } else {
            	   icone = base_url+"/img/icons_map/"+icon_param;
               }
             
               if(description != ''){
                    title = name+' - '+description
               }else{
                    title = name;
               }
               if (icon_param.special){
            	   //Cria marcador para OTDR
	               mark = new MarkerWithLabel({
	                    icon : icone,
	                    position: new google.maps.LatLng(lat, lng),
	                    map: Map.map,
	                    title: title,
	                    draggable:false,
	                    labelClass: icon_param.classe,
	                    labelAnchor: new google.maps.Point(5, 5),
	               });
               } else {
            	   //Cria marcador normal
                   mark = new google.maps.Marker({
                       icon : icone,
                       position: new google.maps.LatLng(lat, lng),
                       map: null,
                       title: title,
                       draggable:false,
                  });
               }
               return mark;  
          },

		}

		return self;

})
