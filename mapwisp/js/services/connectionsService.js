// //  @ts-check

/**
 * @typedef {import("../types/types").Pet} Pet
 * @typedef {import("../types/types").AccessPoint} AccessPoint
 */

app.service('Connections', function($rootScope,Map,dialogService,$q,Cables,Fusions,Functions,$timeout,$http, $interval,LevelsAndModes,Dios){
	var self = {
		isLoading : false,
		accessPointOpen : false,
        /** @type {AccessPoint | null} */
        accessPointOpened : null,
        dioOpened : null,
        showDioCableAdd : false,
		dioCablePaths: [],
		dioLinePaths: [],
		hoveredSlot : { connection_id: null, fiber: null},
		dioTrayConnectionData: [],
		dioPortConnectionData: [],
		cont_slots : 0,
        editing_splitter : false,
		originalApShow: false,
		connectionsOrHostsLeft : 0,
		is_desbalanceado : false,
		is_balanceado : false,
		is_two_inputs : false,
		otdrSlot: [],
		tubeColorCode: [],
		access_points_preloaded : [],
		
		savedReportsFusions: [],
		reloadReportsFusions: [],
		savedReportsSlots: [],
		reloadReportsSlots: [],
        setSlotReloadReport: (slot) => self.reloadReportsSlots.push(slot),

		tubeConnect: [],

		sharedDatabase: "",

        hasShownNewLayoutTip: false,
		
		unifilar_visual_loading: false,
		apVisualizerLoadingFiberReports: false,

		list_all_connections : function(){
			var connections;
			$.ajax({
				url: $rootScope.base_url+'/access_point_connections/list_all',
				type: 'POST',
				async: false,
				complete:function(response){
					connections = response.responseJSON;
				}
			});
			return connections;
		},
		
		splitters_in_ap : function(connections, ap_id){
			var splitters = [];
			var i;
			for (i = 0; i < connections.length; i++){
				if (connections[i].access_point_id == ap_id){
					if (connections[i].splitter_id != null){
						if (connections[i].splitter){
							if (connections[i].splitter.type < 2 || connections[i].splitter.type == 4){
								splitters.push(connections[i].splitter);
							}
						}
					}
				}
			}
			return splitters;
		},

		list_all_hosts : function(){
			var connections;
			$.ajax({
				url: $rootScope.base_url+'/hosts/list_all',
				type: 'POST',
				async: false,
				complete:function(response){
					connections = response.responseJSON;
				}
			});
			return connections;
		},

        closeCurrentAccessPoint : function(){
            $rootScope.dialogService.cancel('accessPoint');
        },
		
		removeConnection : function(connection_id, connection, access_point, all_connections){
			
			self.isLoading = true;
			
			if ($rootScope.Buildings.buildingOpen){
				dot_id = $rootScope.Buildings.buildingOpen.dot.id;
			} else {
				dot_id = access_point.dot.id;
			}
			cable_id = connection.cable.id;
			
			// Create data array to be sent
			data = {};
			data.dot_id = dot_id;
			data.cable_id = cable_id; 
			data.ids = [];
			//populate connection ids to be deleted
			if (connection.splitter_id){
				data.ids.push(connection.id);
			} else if ($rootScope.Buildings.buildingOpen && connection.cable.building_conn_a_id && connection.cable.building_conn_b_id){
				// Is a connection to an internal cable, in a building
				var cable_connections = $rootScope.Buildings.getCableConnectionsBothEnds(connection.cable);
				data.ids = cable_connections.map(function(obj){return obj.id});
			} else {
				left = connections.connectionsLeft;
				right = connections.connectionsRight;
				for (var i = 0; i < left.length; i++){
					if (left[i].cable.id == cable_id){
						data.ids.push(left[i].id);
					}
				}
				for (var i = 0; i < right.length; i++){
					if (right[i].cable.id == cable_id){
						data.ids.push(right[i].id);
					}
				}
			}
			$.ajax({
				url: $rootScope.base_url+'/access_points/delete_connection',
				type: 'POST',
				data: data,
				complete:function(response){
					if (response.responseJSON.status == 1){
						$rootScope.dialogService.cancel('accessPoint');
						
						//limpar cache de fusoes
						for (var slot of connection.slots){
							if(slot.report_data){
								for (var fus of slot.report_data.fusions){
									self.reloadReportsFusions.push(fus.id);
								}
							}
						}
						$rootScope.Fusions.reloadRoutes = true;

						if (connection.splitter_id){
							self.openAccessPoint(self.accessPointOpened);

						// @brunopauls - 14/04/2020
						// The condition below was checking only for the conn_a_id, and checking if it was not null.
						// That used to indicate that this was an internal building cable. That is no longer true, since
						// building_conn_a_id is used to indicate cables from the map entering the building.
						// For that reason I'm now changing the condition to check both "a" and "b" sides. If both are populated,
						// then its an internal cable.
						} else if (connection.cable.building_conn_a_id && connection.cable.building_conn_b_id){
							$rootScope.Cables.deleteBuildingCable(cable_id);
						} else {
							Cables.redrawCable(cable_id,false);
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
						$rootScope.messageAlert = $rootScope.Users.translateText(response.responseJSON.message);
						model = [];  
						$rootScope.dialogService.open("alertModal","alertModal", model, options).then();
					}

					self.isLoading = false;
				}
			});
		},
        

        /**
         * edit Connection method
         * @param {*} connectionData 
         */
        editConnection : function(connectionData){
			$.ajax({
				url: $rootScope.base_url+"/access_point_connections/edit",
				type: "POST",
				data: connectionData,
				async: true,
                success: function(response) {
                },
				complete:function(response){
                    
				}
			});
        },

		/**
         * edit Host Coords method
         * @param {*} hostData 
         */
        editHostCoords : function(hostData){
            console.log("edit host coords:", hostData);
			$.ajax({
				url: $rootScope.base_url+"/hosts/edit",
				type: "POST",
				data: hostData,
				async: true,
                success: function(response) {
                    console.log("host edit response:", response);
                },
				complete:function(response){
                    
				}
			});
        },

		/**
         * edit Dio Coords method
         * @param {*} dioData 
         */
        editDioCoords : function(dioData){
            console.log("edit dio coords:", dioData);
			$.ajax({
				url: $rootScope.base_url+"/dios/edit",
				type: "POST",
				data: dioData,
				async: true,
                success: function(response) {
                    console.log("dio edit response:", response);
                },
				complete:function(response){
                    
				}
			});
        },

        toggleRemoveFusions : function(){
            // Toggle button appearance
            self.removingFusions = !self.removingFusions;
            
            // Toggle actual cutton funcionality inside apv
            $rootScope.apVisualizer.toggleRemoveFusions();
        },
		
		/**
		 * Remove Single Connection method
		 * 
		 * Deletes one single connection, whose ID is sent in the parameters
		 * Should only be used if the related access point will be deleted right after
		 * */
		removeSingleConnection : function(connection_id){
			//create data array to be sent
			data = {};
			data.id = connection_id;
			$.ajax({
				url: $rootScope.base_url+'/access_points/delete_single_connection',
				type: 'POST',
				data: data,
				async: false,
				complete:function(response){
					
				}
			});
		},

		removeHost : function(host){
			if (self.hostFree(host)){
				self.isLoading = true;
				$.ajax({
					url: $rootScope.base_url+'/hosts/delete',
					type: 'POST',
					data: {id:host.id},
					complete:function(response){
						if(response.responseJSON.status == 1){
							$rootScope.dialogService.cancel('accessPoint');
								self.openAccessPoint(self.accessPointOpened).then(function(){
								self.isLoading = false;	
							});	
						}
					}
				});
			} else {
				$rootScope.messageAlert = $rootScope.Users.translateText('<h6>Ativo possui fibras conectadas. Delete-as antes de removê-lo.</h6>');
				var options = {
                        autoOpen: false,
                        modal: true,
                        title: $rootScope.Users.translateText('Atenção'),
                        width: 'auto',
                        height:'auto',
                        resizable:true,
                        dialogClass: "noclose", 
                };
                model = [];  
                $rootScope.dialogService.open('alertModal','alertModal', model, options).then();
			}
		},

		hostFree : function(host){
			free = true;
			angular.forEach(host.ports, function(port, port_index){
				if (port.connected){
					free = false;
				}
			});
			return free;
		},

		removeDio : function(dio){
			self.isLoading = true;
			$.ajax({
				url: $rootScope.base_url+'/dios/delete',
				type: 'POST',
				data: {id:dio.id},
				complete:function(response){
					$timeout(function(){
						if(response.responseJSON.status == 1){
							$rootScope.dialogService.cancel('accessPoint');
							self.openAccessPoint(self.accessPointOpened);
							self.isLoading = false;
						} else {
							self.isLoading = false;
						}
					});
				}
			});
		},
		
		openAccessPointFromReport : function(id){

			for(var x = 0; x < $rootScope.Buildings.buildings.length; x++){
				var building = $rootScope.Buildings.buildings[x];
				for(var i = 0; i < building.floors.length; i++){
					var floor = building.floors[i];
					for(var j = 0; j < floor.access_points.length; j++){
						if(floor.access_points[j]){
							var apId = self.sharedDatabase ? floor.access_points[j].real_id : floor.access_points[j].id;
							if(apId === id){
								$rootScope.dialogService.cancel('accessPoint');
								self.openAccessPoint(floor.access_points[j]);
								return;
							}
						}
					}
				}
			}
				
			angular.forEach($rootScope.AccessPoints.accessPoints,function(ap_cat,cat){
				angular.forEach(ap_cat,function(ap,index){
					var apId = self.sharedDatabase ? ap.real_id : ap.id;
					if(apId == id){
						$rootScope.dialogService.cancel('accessPoint');
						self.openAccessPoint(ap);
						return;
					}
				});
			})
		},



		//---------------------------------------
		// funçoes prontas
		//---------------------------------------

		addHostConfirm: function(){			
			data = {};
			data.access_point_id = self.accessPointOpened.id;
			data.name = $rootScope.form.name
			data.zabbix_link =  $rootScope.form.zabbix_link;
			host_type = Functions.find_on(self.host_types,'id',$rootScope.form.host_type_id)
			data.cost = host_type.price;
			data.host_type_id = host_type.id;			
			data.func = 'add';
			
			$.ajax({
				url: $rootScope.base_url+'/hosts/add',
				type: 'POST',
				data: data,
				complete:function(response){
					
					$rootScope.set_errors_modal(response.responseJSON,'hostApAdd');
					if(response.responseJSON.status == 1){
						$rootScope.dialogService.cancel('accessPoint');
							self.openAccessPoint(self.accessPointOpened).then(function(){
							self.isLoading = false;	
						});	
					}
					
					
				}
			});
		},


		addHost : function(){			
			var options = {
				autoOpen: false,
				modal: true,
				title: $rootScope.Users.translateText("Adicionar equipamento"),
				width: 300,
				height: 'auto',
				resizable:false,
				close:function(){
					$rootScope.form = [];
					$rootScope.form.error = [];
				}
			};
			model = [];  
			$rootScope.form = [];
			$rootScope.form.error = [];
			$rootScope.dialogService.open('hostApAdd','hostApAdd', model, options);
		},

		addDio : function(){			
			var options = {
				autoOpen: false,
				modal: true,
				title: $rootScope.Users.translateText("Adicionar DIO"),
				width: 300,
				height: 'auto',
				resizable:false,
				close:function(){
					$rootScope.form = [];
					$rootScope.form.error = [];
				}
			};
			model = [];  
			$rootScope.form = [];
			$rootScope.form.error = [];
			$rootScope.dialogService.open('dioAdd','dioAdd', model, options);
		},

		addDioConfirm: function(){			
			data = {};
			data.access_point_id = self.accessPointOpened.id;
			data.name = $rootScope.form.name;
			data.columns_number = $rootScope.form.columns_number;
			data.lines_number = $rootScope.form.lines_number;
			data.func = 'add';
			
			$.ajax({
				url: $rootScope.base_url+'/dios/add',
				type: 'POST',
				data: data,
				complete:function(response){
					
					$rootScope.set_errors_modal(response.responseJSON,'dioAdd');
					if(response.responseJSON.status == 1){
						var dioData = response.responseJSON.data;

						angular.forEach(dioData.dio_ports, function(port,index){
							port.id_html = 'dio_port_'+dioData.id+'_'+index;
							port.col = 'L';
							port.dio_id = dioData.id;
						});


						response.x_newLayout = dioData.x;
						response.y_newLayout = dioData.y;
						
						dios.push(dioData);	
							
						$rootScope.apVisualizer.drawDiosConnections();
					}
					
					
				}
			});
		},

		editDioName: async function (dio) {

            var options = {
				autoOpen: false,
				modal: true,
				title: $rootScope.Users.translateText("Editar nome"),
				width: 300,
				height: 'auto',
				resizable:false,
				close:function(){
					$rootScope.form = [];
					$rootScope.form.error = [];
				}
			};
			model = [];
			$rootScope.form = [];
			$rootScope.form.error = [];
			//Current data
			$rootScope.form.id = dio.id;
			$rootScope.form.name = dio.name;

			//open modal
			$rootScope.dialogService.open('dioNameEdit','dioNameEdit', model, options);
        },

		editDioNameConfirm: function(){			
			data = {};
			data.id = $rootScope.form.id;
			data.name = $rootScope.form.name;
			
			$.ajax({
				url: $rootScope.base_url+'/dios/editDioName',
				type: 'POST',
				data: data,
				complete:function(response){
					
					var dioData = response.responseJSON.data;
					if(response.responseJSON.status == 1){

						$rootScope.apVisualizer.updateDioData(dioData);

						$rootScope.dialogService.cancel('dioNameEdit');
						
					}
					
					
				}
			});
		},

		addTray: function(){			
			data = {};
			data.dio_id = self.dioOpened.id;
			data.func = 'add';
			
			$.ajax({
				url: $rootScope.base_url+'/dios/add_tray',
				type: 'POST',
				data: data,
				complete:function(response){
					
					var dioData = response.responseJSON.data;
					if(response.responseJSON.status == 1){

						self.updateDioOpened(dioData);

					}
					
					
				}
			});
		},

		trayContentJsonDecode: function(dioData){

			angular.forEach(dioData.dio_trays, function(tray, index) {
				// Verifica se tray.tray_content_json é uma string não vazia
				if (typeof tray.tray_content_json === 'string' && tray.tray_content_json.trim() !== '') {
					// Faz o parse apenas se não estiver vazio
					tray.tray_content_json = JSON.parse(tray.tray_content_json);
				} else {
					// Define como um array vazio se for vazio ou não for uma string
					tray.tray_content_json = [];
				}
			});

		},			

		removeTray: function(tray){	

			if (!confirm("Tem certeza de que deseja remover?")) {
				return;
			}
			
			var tubeConnections = [];

			if (!jQuery.isEmptyObject(tray.tray_content_json)) {

				for (let content of tray.tray_content_json) {
					for (let connection of self.dioOpened.dio_connections) {
						if (connection.cable_id === content.cable_id) {
							for (let slot of connection.slots) {
									if (Math.floor((slot.fiber - 1) / (connection.slots.length/connection.cable.cable_type.tubes)) === (content.tubeIndex - 1)) {

										tubeConnections.push({connection_id: slot.connection_id, fiber: slot.fiber});
									}
							}
							// break;
						}
					}
				}
			}
			
			data = {};
			data.dio_id = self.dioOpened.id;
			data.id = tray.id;
			data.tubeConnections = JSON.stringify(tubeConnections),
			
			$.ajax({
				url: $rootScope.base_url+'/dios/remove_tray',
				type: 'POST',
				data: data,
				complete:function(response){
					
					var dioData = response.responseJSON.data;
					if(response.responseJSON.status == 1){

						self.updateDioOpened(dioData);
						
					}
					
					
				}
			});
		},

		editDioConnection: function(cable){			
			data = {};
			data.cable_id = cable.id;
			data.access_point_id = self.dioOpened.access_point_id;
			data.connected_dio_id = self.dioOpened.id;
			
			$.ajax({
				url: $rootScope.base_url+'/dios/editDioConnection',
				type: 'POST',
				data: data,
				complete:function(response){
					
					var dioData = response.responseJSON.data;
					if(response.responseJSON.status == 1){

						self.updateDioOpened(dioData);
						
					}
					
					
				}
			});
		},
		
		dioTrayConnect: function(tray,connection_new){			
			data = {};
			data.id = tray.id;
			data.dio_id = tray.dio_id;
			data.tray_content_json = JSON.stringify(tray.tray_content_json),

			
			$.ajax({
				url: $rootScope.base_url+'/dios/dio_tray_connect',
				type: 'POST',
				data: data,
				complete:function(response){
					
					var dioData = response.responseJSON.data;
					if(response.responseJSON.status == 1){

						self.dioTrayConnectionData = [];

						//atualiza a nova conexão
						if(connection_new){
							self.createSplitterConnection(connection_new);
							var find = self.connections.connectionsLeft.findIndex
								(t => t.splitter_id === connection_new.splitter_id);
								if (find >= 0) {
									$rootScope.apVisualizer.accessPointData.cableConnections[$rootScope.apVisualizer.accessPointData.cableConnections.length] = self.connections.connectionsLeft[find];
								}
						}

						self.updateDioOpened(dioData);

					}
					
					
				}
			});
		},

		updateDioOpened: function(dioData){

			//decodificar json
			self.trayContentJsonDecode(dioData);

			angular.forEach(dioData.dio_ports, function(port,index){
				port.id_html = 'dio_port_'+dioData.id+'_'+index;
				port.col = 'L';
				port.dio_id = dioData.id;
			});

			// Atualiza o array de dios
			for (let i = 0; i < self.dios.length; i++) {
			    if (self.dios[i].id === dioData.id) {
			        self.dios[i] = dioData;
			        break;
			    }
			}


			self.dioUpdateConnections(dioData);

			self.dioOpened = dioData;

			$timeout(function(){
				
				self.filteredConnections = $rootScope.apVisualizer.accessPointData.cableConnections.filter(function(conn) {
					return !self.dioOpened.dio_connections.find(c => c.cable_id === conn.cable_id);
				});
				
			}, 100);

			$rootScope.$apply();

			self.drawDioCableSvgs(dioData.dio_trays);

		},

		removeTrayConnection: function(content, tubeIndex){

			var tubeConnections = [];
			var data = {};
			
			for (let tray of self.dioOpened.dio_trays) {
			    if (!jQuery.isEmptyObject(tray.tray_content_json)) {

					var find = tray.tray_content_json.findIndex((t) => !content.cable_type_id ? (t.splitter_id === content.id)
	                    : (t.cable_id === content.id && t.tubeIndex === tubeIndex));

					if (find >= 0) {

						var tray_content_json = tray.tray_content_json[find];

						if(tray_content_json.splitter_id){
							data.splitter_id = tray_content_json.splitter_id;
						}

						// if(content.cable_type_id){
							//atualiza a conexao do cabo
							for (let connection of self.dioOpened.dio_connections) {
							    if (tray_content_json.cable_id ? connection.cable_id === tray_content_json.cable_id
									: connection.splitter_id === tray_content_json.splitter_id) {
							        for (let slot of connection.slots) {
										if(tray_content_json.cable_id){
											//verifica se faz parte do mesmo tubo
											if (Math.floor((slot.fiber - 1) / (connection.slots.length/connection.cable.cable_type.tubes)) === (tubeIndex - 1)) {
		
												tubeConnections.push({connection_id: slot.connection_id, fiber: slot.fiber});
											}
										}else{
											tubeConnections.push({connection_id: slot.connection_id, fiber: slot.fiber});
										}
							        }
							        break;
							    }
							}
							data.tubeConnections = JSON.stringify(tubeConnections);
						// }

						//remove a conexão do tubo
						tray.tray_content_json.splice(find, 1);

						data.id = tray.id;
						data.dio_id = tray.dio_id;
						data.tray_content_json = JSON.stringify(tray.tray_content_json);
						
			
						
						$.ajax({
							url: $rootScope.base_url+'/dios/remove_tray_connection',
							type: 'POST',
							data: data,
							complete:function(response){
								
								var dioData = response.responseJSON.data;
								if(response.responseJSON.status == 1){
			
									self.updateDioOpened(dioData);
			
								}
								
								
							}
						});

						
					}
			    }
			}
			
		},

		removeDioConnection : function(dioConn){
			
			//Open Modal
			var options = {
					autoOpen: false,
					modal: true,
					title: $rootScope.Users.translateText("Remover conexao"),
					width: 300,
					height: 'auto',
					resizable:false,
					close:function(){
					}
			};
			model = [];
			$rootScope.dioConn = dioConn;
			$rootScope.dialogService.open('removeDioConn','removeDioConn', model, options);
			
			
		},

		removeDioConnectionConfirm : function(dioConn){
			
			dioConn.connection_id = null;
			dioConn.fiber = null;

            self.dioEditPortConfirm(dioConn);

		},

		dioSlotAnimate : function(slot, type){

			var elementId = type === 1 ? "#dioPort_" + slot.id : "#trayConnSlot_" + slot.connection_id + "_" + slot.fiber;

			if ($(elementId).hasClass("slot-connect-blink")) {
				$(elementId).removeClass("slot-connect-blink");
			}else{
				$(elementId).addClass("slot-connect-blink");
			}
			
		},

        dioEditPort : function(slot, type){

			// type = 1 dio_port
			// type = 2 splitter
			// type = 3 cable
			// type = 4 host

            console.log("Dio Edit Port");
            console.log("slot", slot);
            console.log("type", type);

			//Primeiramente, impedindo usuario level 1 de fazer qualquer alteracao.
			if(LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_VIEW, LevelsAndModes.levels.NIVEL_VIEWEXPORT])){
				return;
			}

			// Caso já esteja conectado pergunta se quer desconectar
			if($rootScope.apVisualizer.dioOpened && self.isDioConnected(slot)){
				self.removeDioConnection(slot);
				return;
			}

			//cria o array
			if (!self.dioPortConnectionData) {
                self.dioPortConnectionData = [];
            }

			if(!self.cont_slots || self.cont_slots == 0){
				
				self.dioPortConnectionData.source = slot;
				self.dioPortConnectionData.source.type = type;

				self.dioSlotAnimate(slot, type);
				
			}else if(self.cont_slots == 1){

				self.dioPortConnectionData.target = slot;
				self.dioPortConnectionData.target.type = type;
				
			}

			self.cont_slots++;

			
			if(self.cont_slots == 2){

				//impede conectar porta do splitter em porta do dio e entrada de splitter em slot cabo
				if((self.dioPortConnectionData.source.type === 2 && self.dioPortConnectionData.source.fiber > 0 && self.dioPortConnectionData.target.type === 1) ||
				  (self.dioPortConnectionData.target.type === 2 && self.dioPortConnectionData.target.fiber > 0 && self.dioPortConnectionData.source.type === 1) || 
				   (self.dioPortConnectionData.source.type === 2 && self.dioPortConnectionData.source.fiber === 0 && self.dioPortConnectionData.target.type === 3) ||
				  (self.dioPortConnectionData.target.type === 2 && self.dioPortConnectionData.target.fiber === 0 && self.dioPortConnectionData.source.type === 3)){

					alert($rootScope.Users.translateText('Impossível conectar'));  

					self.dioPortConnectionData = [];

					var elements = document.querySelectorAll('.slot-connect-blink');
					// Itera sobre os elementos e remove a classe
					elements.forEach(function (element) {
						element.classList.remove('slot-connect-blink');
					});

					return;

				}
				
				self.dioEditPortConfirm(self.dioPortConnectionData);
			}
            
        },

		dioEditPortConfirm : function(dioConn){

			var url = $rootScope.base_url+'/dios/edit_port';

			dataSend = {};

			//caso esteja conectando a porta de um splitter num slot de cabo
			if((self.dioPortConnectionData.source.type === 2 && self.dioPortConnectionData.source.fiber > 0) ||
			   (self.dioPortConnectionData.target.type === 2 && self.dioPortConnectionData.target.fiber > 0)){

				dataSend.access_point_connection_id_in = self.dioPortConnectionData.source.connection_id;
				dataSend.access_point_connection_id_out = self.dioPortConnectionData.target.connection_id;
				dataSend.fiber_in = self.dioPortConnectionData.source.fiber;
				dataSend.fiber_out = self.dioPortConnectionData.target.fiber; 
				dataSend.connection_type =  0;
				dataSend.draw_type =  0 ;
				dataSend.loss = 0;

				url = $rootScope.base_url+'/access_points/add_fusion';
				
			}else{

				// Esse trecho só é necessário pra conectar à porta do DIO
	            dataSend.id = dioConn.id;
	
				//pega informações da conexão com cabo
				dataSend.connection_id = dioConn.connection_id;
				dataSend.fiber = dioConn.fiber;
	
				//pega informações do host
				dataSend.host_id = dioConn.host_id;
				dataSend.host_port = dioConn.host_port;

			}
			
            var result = {};
            $.ajax({
                url: url,
                type: 'POST',
                data: dataSend,
                async: false,
                success:function(response){
					
                    var dioData = response.data;
					if(response.status == 1){

						result = {
                            "success" : response.status == 1,
                            "data": response.data,
                            "errors": response.errors
                        };

						self.updateDioOpened(dioData);

						self.dioPortConnectionData = [];

						$rootScope.Fusions.target = [];
                    	$rootScope.Fusions.cont_slots = 1;

						if(dialogService.isOpen('removeDioConn')){
							dialogService.close('removeDioConn');
						} 

						$rootScope.apVisualizer.dioConnectResult(result);

						self.cont_slots = 0;
						
					}

                    

                },
                error: function(error) {
                    console.log("ADD FUSION ERROR!", error);
                    result = {
                        "success" : false,
                        "data": error,
                    };
                },
                complete: function(data) {
                    //console.log("ADD FUSION COMPLETE!", data);
                }
            });

		},

				// CABLES  //

		getColumnIndex : function(index, columnsNumber) {
			return index % columnsNumber;
		},
		
		getRowIndex : function(index, columnsNumber) {
			return Math.floor(index / columnsNumber);
		},
				

		getKeys : function(obj){
			return Object.keys(obj);
		},

		/* Filtrar os slots que pertencem ao respectivo tubo */
		filteredTubeSlots : function(conn, tube){
			var fiberByTube = (conn.cable.cable_type.number_fibers / conn.cable.cable_type.tubes);
			return conn.slots.filter(c=>(Math.floor((c.fiber - 1) / (fiberByTube))) === tube);
		},

		filteredCableConn : function(cable_id){

			return self.dioOpened.dio_connections.find(c => c.cable_id === cable_id);

		},

		filteredSplitterConn : function(splitter_id){

			return self.dioOpened.dio_connections.find(c => c.splitter_id === splitter_id);

		},

		printDio : function(){

			// cria doc pdf com true para comprimir
            var doc = new jsPDF('l','px','a4',true);

			//necessário pra imprimir a pagina inteira 
			document.querySelector('#dioContainer').style.overflow = 'visible'; 
			
            html2canvas(document.querySelector("#dioContainer"), {
			    width: document.querySelector("#dioContainer").scrollWidth,
			    height: document.querySelector("#dioContainer").scrollHeight,
				backgroundColor: '#ccc'
			}).then(function(canvas) {
			    imgData = canvas.toDataURL('image/jpg');
			
			    // Reseta a posição do mapa 
			    $("#dioContainer>div>div").find("canvas:last").css({
			        left: "auto",
			        top: "auto",
			        position: "static",
			        transform: "none"
			    });
			
			    // Adiciona a imagem criada do mapa ao PDF 
			    // FAST para comprimir
			    var doc = new jsPDF({
			        orientation: 'landscape',
			        unit: 'px',
			        format: [canvas.width, canvas.height ]
			    });
			
			    doc.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height, '', 'FAST');
			    doc.save('Mapwisp_mapa.pdf');

				//faz aparecer o scroll novamente
				document.querySelector('#dioContainer').style.overflow = 'scroll';
			});
			
		},
		
		isDioConnected: function(slotData) {
			var connected = false;
			var slotPort = null;
			for (const c2 of self.dios) {
			    for (const p of c2.dio_ports) {
			        let match = false;
			        if (slotData.port_information) {
			            if (p.host_id === slotData.host_id && p.host_port === slotData.port_information.number) {
			                connected = true;
							break;
			            }
			        } else if(slotData.connection_id){
			            if (p.connection_id === slotData.connection_id && p.fiber === slotData.fiber) {
			                connected = true;
							break;
			            }
			        } else {
						//caso o dio esteja aberto, verifica se está conectado a um tubo
						//caso esteja fechado verifica se está conectado ao host
			            if (p.id === slotData.id) {

							if((self.dioOpened && p.connection_id) || (!self.dioOpened && (p.host_id !== null))){
				                connected = true;
							}

							//necessário pra exibir como conectado
							var port_id = p.id_html + "_" + p.port_number;
							$rootScope.apVisualizer.hoveredPortid = port_id;
							break;
			            }
			        }
			
			    }
			    if (connected) {
			        break;
			    }
			}

			//verificar pela fusões se está conectado
			if (slotData.connection_id) {
				self.connections.fusions.forEach(fusion => {
					
					//armazena a conexão da fusão entre slot de cabo e porta do dio
					//usado para indicar no hover que estão conectados
					if (fusion.access_point_connection_id_in === slotData.connection_id && fusion.fiber_in === slotData.fiber){
						slotData.fusion_connection_id = fusion.access_point_connection_id_out;
						slotData.fusion_fiber = fusion.fiber_out;
						connected = true;
					}else if(fusion.access_point_connection_id_out === slotData.connection_id && fusion.fiber_out === slotData.fiber) {
						slotData.fusion_connection_id = fusion.access_point_connection_id_in;
						slotData.fusion_fiber = fusion.fiber_in;
						connected = true;
					}
						
				});
			}
		
			return connected;
		},

		filteredLineTubeTray : function(cable_id, tubeIndex){

			var connected = false;

			self.dioOpened.dio_trays.filter(c2 => c2.tray_content_json.filter((s2, index) => 
				s2.cable_id === cable_id && s2.tubeIndex === tubeIndex).forEach(tray_content_json => {
					    connected = true;
					  }));

			return connected;

		},

		/**
		 * Draw Cable SVGs method
		 * Generate all paths for the cables in the current building
		 * and stores them in the cablePaths array
		 * */
		drawDioCableSvgs : function(trays){
			self.dioCablePaths = [];
			self.client_y_values = [];
			self.ap_x_values = [];

			d3.select(".dio-svg").selectAll("svg").remove();
			// d3.selectAll("[id^='lineTubeTray_']").remove()
			$(".dio-svg").innerHTML = "";
			
			var svg = d3.select(".dio-svg").append("svg")
				.style("width", "100%")
				.style("height", 480);

			// Init vars to hold coordinates
			var container_position = $( "#dio-main-container" ).offset();

			angular.forEach(trays, function(tray, idx){
				// Get connection A coordinates				

				// Tubes
				for(content of tray.tray_content_json){

					if(!content.cable_id){
						continue;
					}

					// var cableConnection = $rootScope.apVisualizer.accessPointData.cableConnections.find((c) => c.cable_id === content.cable_id);
					var cableConnection = self.dioOpened.dio_connections.find((c) => c.cable_id === content.cable_id);

					var tubeHTML = $("#dioCableTube_" + content.cable_id + "_" + content.tubeIndex);
					var tubePos = tubeHTML.offset();
					if(!tubePos){
						return;
					}
					tubeHTML_x = tubePos.left - container_position.left;
					tubeHTML_y = tubePos.top - container_position.top;

					var trayInHTML = $("#trayIn" + content.side + "_" + tray.id);
					var trayInPos = trayInHTML.offset();
					if(!trayInPos){
						return;
					}
					trayIn_x = trayInPos.left - container_position.left;
					trayIn_y = trayInPos.top - container_position.top;

					svg.append("path")
						.attr("id", function(d) {
							var id = "lineTubeTray_"  + content.cable_id + "_" + content.tubeIndex;
							return id;
						})
						.attr("d", function(d) {

							var x1 = tubeHTML_x + 10; 
							var y1 = tubeHTML_y + 25;
							var x4 = trayIn_x + 10;
							var y4 = trayIn_y;
							
							var y2 = y1 + 25;
							var y3 = y4 - 50;
							
							// Adiciona curvas nos pontos x2, y1 e x3, y4
							var linePath = d3.line()
								.x(function(d) { return d[0]; })
								.y(function(d) { return d[1]; })
								.curve(d3.curveBasis); // Usando a curva Bezier cúbica
							
							var points = [
								[x1, y1],
								[x1, y2],
								[x4, y3],
								[x4, y4]
							];
							
							var pathData = linePath(points);
							
							return pathData;
						})
						.style("fill", "none")
						.attr("stroke-width", 10)
						.attr("class", "lineTubeTray")
						// .style("opacity", _this.dioOpened ? 1 : 0)
						// .style("cursor", "url('" + _this.configuration.base_url + "/img/scissors.svg'), pointer")
						.style("stroke", self.tubeColorCode[cableConnection.cable.cable_type.code_color][content.tubeIndex])
						.raise()
						.on("click", function(e, tray) {
							if (!confirm("Tem certeza de que deseja remover?")) {
								return;
							}

							// var tubeData = JSON.parse(d3.select(e.currentTarget).attr("tubeData"));
							// removeTube(tray, tubeData);
						});
				}
			});
		},
		
		drawDioLineSvgs : function(dio_ports){
			self.dioCablePaths = [];
			self.client_y_values = [];
			self.ap_x_values = [];

			// d3.select(".dio-svg-port").selectAll("svg").remove();
			// $(".dio-svg-port").innerHTML = "";
			
			// var svg = d3.select(".dio-svg-port").append("svg")
			// 	.style("width", "100%")
			// 	.style("height", 380);

			// Init vars to hold coordinates
			var container_position = $( "#dioContainer" ).offset();

			angular.forEach(dio_ports, function(port, idx){

				//se não estiver conectado não faz nada
				if(!port.connection_id || !port.fiber){
					return;
				}

				var portHTML = $("#dioPort_" + port.id);
				var portPos = portHTML.offset();
				if(!portPos){
					return;
				}
				var port_x = portPos.left - container_position.left;
				var port_y = portPos.top - container_position.top;

				var slotHTML = $("#trayConnSlot_" + port.connection_id + "_" + port.fiber);
				var slotPos = slotHTML.offset();
				if(!slotPos){
					return;
				}
				var slotHTML_x = slotPos.left - container_position.left;
				var slotHTML_y = slotPos.top - container_position.top;

				var x1 = tubeHTML_x + 10; 
				var y1 = tubeHTML_y + 25;
				var x4 = trayIn_x + 10;
				var y4 = trayIn_y;
				
				var y2 = y1 + 25;
				var y3 = y4 - 50;
				
				var points = [
					[x1, y1],
					[x1, y2],
					[x4, y3],
					[x4, y4]
				];

				path1 = {};
				path1.x1 = x1;
				path1.y1 = y1;
				path1.x2 = x4;
				path1.y2 = x4;
				path1.connection_id = port.connection_id;
				path1.fiber = port.fiber;
				// path1.port_id = port.id;
				path1.color = "blue";
				
				self.dioLinePaths.push(path1);

				// svg.append("path")
				// 	.attr("id", function(d) {
				// 		var id = "linePort_"  + port.connection_id + "_" + port.fiber;
				// 		return id;
				// 	})
				// 	.attr("d", function(d) {

				// 		var x1 = port_x + 10; 
				// 		var y1 = port_y + 25;
				// 		var x4 = slotHTML_x + 10;
				// 		var y4 = slotHTML_y;
						
				// 		var y2 = y1 + 25;
				// 		var y3 = y4 - 50;
						
				// 		// Adiciona curvas nos pontos x2, y1 e x3, y4
				// 		var linePath = d3.line()
				// 			.x(function(d) { return d[0]; })
				// 			.y(function(d) { return d[1]; })
				// 			.curve(d3.curveBasis); // Usando a curva Bezier cúbica
						
				// 		var points = [
				// 			[x1, y1],
				// 			[x1, y2],
				// 			[x4, y3],
				// 			[x4, y4]
				// 		];
						
				// 		var pathData = linePath(points);
						
				// 		return pathData;
				// 	})
				// 	.style("fill", "none")
				// 	.attr("stroke-width", 10)
				// 	.attr("class", "lineTubeTray")
				// 	// .style("opacity", _this.dioOpened ? 1 : 0)
				// 	// .style("cursor", "url('" + _this.configuration.base_url + "/img/scissors.svg'), pointer")
				// 	.style("stroke", "blue")
				// 	.raise();
			});
		},

		trayTubeConnect : function (dioConn, input){

			//cria o array
			if (!self.dioTrayConnectionData.tray_content_json) {
                self.dioTrayConnectionData.tray_content_json = [];
            }

			if(dioConn.cable_id){
				if(self.dioTrayConnectionData.tray_content_json.cable_id === dioConn.cable_id 
				   && self.dioTrayConnectionData.tray_content_json.tubeIndex === input){
						self.dioTrayConnectionData = [];
				   }else{
						self.dioTrayConnectionData.tray_content_json.cable_id = dioConn.cable_id;
						self.dioTrayConnectionData.tray_content_json.tubeIndex = input;
				   }
				
			}else{
				//adiciona o lado da bandeja
				self.dioTrayConnectionData.tray_id = dioConn.id;
				self.dioTrayConnectionData.tray_content_json.side= input;
			}

			//caso faltar informação retorna pois não foi dado o clique para conectar tubo e entrada de badeja
			if(!self.dioTrayConnectionData.tray_content_json.cable_id || !self.dioTrayConnectionData.tray_content_json.side){
				return;
			}

			self.dioTrayConnectionData.tray_content_json = {cable_id: self.dioTrayConnectionData.tray_content_json.cable_id,
														   tubeIndex: self.dioTrayConnectionData.tray_content_json.tubeIndex,
														   side: self.dioTrayConnectionData.tray_content_json.side}

			var trayData;

			for (const tray of self.dioOpened.dio_trays) {
			    if (tray.id === self.dioTrayConnectionData.tray_id) {
			        // Caso encontre o typo no json, deleta para exibir corretamente
			        if (!jQuery.isEmptyObject(tray.tray_content_json)) {
			            const findIndex = tray.tray_content_json.findIndex((t) => 
			                t.cable_id === self.dioTrayConnectionData.tray_content_json.cable_id 
			                && t.tubeIndex === self.dioTrayConnectionData.tray_content_json.tubeIndex
			            );
			            if (findIndex >= 0) {
			                tray.tray_content_json.splice(findIndex, 1);
			            }
			        }

					if (tray.$$hashKey) {
		                delete tray.$$hashKey;
		            }
			
			        trayData = tray;
			        break; 
			    }
			}


			if (trayData.tray_content_json === "") {
                trayData.tray_content_json = [];
            }

			trayData.tray_content_json.push(self.dioTrayConnectionData.tray_content_json);
			
			self.dioTrayConnect(trayData);

        },

		traySplitterConnect : function (tray_id, splitter){

			//cria o array
			if (!self.dioTrayConnectionData.tray_content_json) {
                self.dioTrayConnectionData.tray_content_json = [];
            }

			// if(dioConn.cable_id){
			// 	if(self.dioTrayConnectionData.tray_content_json.cable_id === dioConn.cable_id 
			// 	   && self.dioTrayConnectionData.tray_content_json.tubeIndex === input){
			// 			self.dioTrayConnectionData = [];
			// 	   }else{
			// 			self.dioTrayConnectionData.tray_content_json.cable_id = dioConn.cable_id;
			// 			self.dioTrayConnectionData.tray_content_json.tubeIndex = input;
			// 	   }
				
			// }else{
				self.dioTrayConnectionData.tray_id = tray_id;
				self.dioTrayConnectionData.tray_content_json.splitter_id = splitter.splitter_id;
			// }

			//caso faltar informação retorna pois não foi dado o clique para conectar tubo e entrada de badeja
			// if(!self.dioTrayConnectionData.tray_content_json.cable_id || !self.dioTrayConnectionData.tray_content_json.side){
			// 	return;
			// }

			self.dioTrayConnectionData.tray_content_json = {splitter_id: self.dioTrayConnectionData.tray_content_json.splitter_id}

			var trayData;

			for (const tray of self.dioOpened.dio_trays) {
			    if (tray.id === self.dioTrayConnectionData.tray_id) {
			        // Caso encontre o typo no json, deleta para exibir corretamente
			        if (!jQuery.isEmptyObject(tray.tray_content_json)) {
			            const findIndex = tray.tray_content_json.findIndex((t) => 
			                t.splitter_id === self.dioTrayConnectionData.tray_content_json.splitter_id
			            );
			            if (findIndex >= 0) {
			                tray.tray_content_json.splice(findIndex, 1);
			            }
			        }

					if (tray.$$hashKey) {
		                delete tray.$$hashKey;
		            }
			
			        trayData = tray;
			        break; 
			    }
			}


			if (trayData.tray_content_json === "") {
                trayData.tray_content_json = [];
            }

			trayData.tray_content_json.push(self.dioTrayConnectionData.tray_content_json);
			
			self.dioTrayConnect(trayData,splitter);

        },

		editPortPower : function(port_information, callback){
			var options = {
					autoOpen: false,
					modal: true,
					title: $rootScope.Users.translateText("Editar potencia do sinal"),
					width: 300,
					height: 'auto',
					resizable:false,
					close:function(){
						$rootScope.form = [];
						$rootScope.form.error = [];
					}
				};
				model = [
                    callback
                ];  
				$rootScope.form = [];
				$rootScope.form.error = [];
				$rootScope.form.port_info_id = port_information.id;
				$rootScope.form.power = port_information.power;
				$rootScope.dialogService.open('editPortPowerModal','editPortPowerModal', model, options);
		},

		editPortPowerConfirm : function(callback){
			data = {};
			data.id = $rootScope.form.port_info_id;
			data.power = $rootScope.form.power;
			$.ajax({
				url: $rootScope.base_url+'/hosts/edit_port_information',
				type: 'POST',
				data: data,
				complete:function(response){
					$rootScope.set_errors_modal(response.responseJSON,'editPortPowerModal');
					if(response.responseJSON.status == 1){
                        if (callback){
                            callback(data.power);
                        }

						//TODO atualizar valor no slot correto.
						angular.forEach(self.hosts, function(host, host_index){
							angular.forEach(host.ports, function(port, port_index){
								if (port.port_information.id == data.id){
									self.hosts[host_index].ports[port_index].port_information.power = data.power;
								}
							});
						});
						$rootScope.$apply();
					}	
				}
			});
		},

		editPortRx : function(slot){
			data = {};
			data.id = slot.port_information.id;
			data.rx = slot.port_information.rx ? 0 : 1;
			$.ajax({
				url: $rootScope.base_url+'/hosts/edit_port_information',
				type: 'POST',
				data: data,
				complete:function(response){
					if(response.responseJSON.status == 1){
						let slotUpdated = [];
						//TODO atualizar valor no slot correto.
						angular.forEach(self.hosts, function(host, host_index){
							angular.forEach(host.ports, function(port, port_index){
								if (port.port_information.id == data.id){
									self.hosts[host_index].ports[port_index].port_information.rx = data.rx;
									slotUpdated = port;
								}
							});
						});
						$rootScope.$apply();
						if(!self.originalApShow){
							$rootScope.apVisualizer.updateSlotRx(slotUpdated);
						}
					}	
				}
			});
		},
		
		addSpliter : function(dioTray){
			
			var options = {
				autoOpen: false,
				modal: true,
				title: $rootScope.Users.translateText("Adicionar splitter"),
				width: 300,
				height: 'auto',
				resizable:false,
				close:function(){
					$rootScope.form = [];
					$rootScope.form.error = [];
					self.is_desbalanceado = null;
		    		self.is_balanceado = null;
		    		self.is_two_inputs = null;
				}
			};
			model = [];  
			$rootScope.form = [];
			$rootScope.form.error = [];
			$rootScope.form.splitter_has_fusion = false; // Splitter novo não tem fusões

			if(dioTray){

				$rootScope.form.connected_dio_id = self.dioOpened.id;
				$rootScope.form.tray_id = dioTray.id;

			}

			$rootScope.dialogService.open('splitterAdd','splitterAdd', model, options);
		},
		
		editSplitter : function(connection){
			
			var options = {
				autoOpen: false,
				modal: true,
				title: $rootScope.Users.translateText("Editar splitter"),
				width: 300,
				height: 'auto',
				resizable:false,
				close:function(){
					$rootScope.form = [];
					$rootScope.form.error = [];
					self.editing_splitter = false;
					self.is_desbalanceado = null;
		    		self.is_balanceado = null;
				}
			};
			model = [];
			self.editing_splitter = true;
			$rootScope.form = [];
			$rootScope.form.error = [];
			//Current data
			$rootScope.form.name = connection.splitter.name;
			$rootScope.form.type = connection.splitter.type;
			$rootScope.form.ports_number = connection.splitter.ports_number;
			$rootScope.form.out_one = connection.splitter.out_one;
			$rootScope.form.out_two = connection.splitter.out_two;
			$rootScope.form.in_one = connection.splitter.in_one;
			$rootScope.form.in_two = connection.splitter.in_two;
			$rootScope.form.id = connection.id;
			$rootScope.form.side = connection.side;
			$rootScope.form.splitter_has_fusion = self.hasFusion(connection);
			//Correct modal layout
			self.change_spl_type();

			//faz atualizar o valor do sinal depois de alterado
			if(connection.slots){
				angular.forEach(connection.slots,function(slots,index){
					$rootScope.Fusions.findSlotFusion(slots).then(function(fusion){
						$rootScope.Connections.reloadReportsFusions.push(fusion.id);
					});		
				});
			}

			//open modal
			$rootScope.dialogService.open('splitterAdd','splitterAdd', model, options);
		},
		
		/**
		 * Has Fusion method
		 * 
		 * Returns true if this connection has any fusion connected to it. Returns false otherwise.
		 * */
		hasFusion : function(connection){
			if (!connection){
				return;
			}
			for (var i = 0; i <= connection.slots.length; i++){
				if (connection.slots[i]){
					if (connection.slots[i].connected){
						return true;
					}
				}
			}
			return false;
		},
		
	    change_spl_type : function(){
	    	  if ($rootScope.form.type == 0){
	    		  $rootScope.form.ports_number = 2;
	    		  self.is_desbalanceado = true;
	    		  self.is_balanceado = false;
	    		  self.is_two_inputs = false;
	    	  } else if ($rootScope.form.type == 1) {
	    		  self.is_desbalanceado = false;
	    		  self.is_balanceado = true;
	    		  self.is_two_inputs = false;
	    	  } else if ($rootScope.form.type == 4) {
	    		  self.is_desbalanceado = false;
	    		  self.is_balanceado = false;
	    		  self.is_two_inputs = true;
	    		  // Campos de documentação para as entradas
	    		  if (!$rootScope.form.in_one) $rootScope.form.in_one = '';
	    		  if (!$rootScope.form.in_two) $rootScope.form.in_two = '';
	    	  }
	    },
		
	    update_percentage : function(form_id){
	    	if (form_id == 1){
	    		if ($rootScope.form.out_one < 1){
	    			$rootScope.form.out_one = 1;
	    		}
	    		if ($rootScope.form.out_one > 99){
	    			$rootScope.form.out_one = 99;
	    		}
	    		$rootScope.form.out_two = 100 - $rootScope.form.out_one;
	    	} else {
	    		if ($rootScope.form.out_two < 1){
	    			$rootScope.form.out_two = 1;
	    		}
	    		if ($rootScope.form.out_two > 99){
	    			$rootScope.form.out_two = 99;
	    		}
	    		$rootScope.form.out_one = 100 - $rootScope.form.out_two;
	    	}
	    },
	    
		editHost : function(host){
			
			var options = {
				autoOpen: false,
				modal: true,
				title: $rootScope.Users.translateText("Editar host"),
				width: 300,
				height: 'auto',
				resizable:false,
				close:function(){
					$rootScope.form = [];
					$rootScope.form.error = [];
				}
			};
			model = [];
			$rootScope.form = [];
			$rootScope.form.error = [];
			//Current data
			$rootScope.form.name = host.name;
			$rootScope.form.id = host.id;

			//open modal
			$rootScope.dialogService.open('hostEdit','hostEdit', model, options);
		},

		editHostConfirm : function(){

			dataSend = {};
			dataSend.id = $rootScope.form.id;
			dataSend.name = $rootScope.form.name;
			self.isLoading = true;
			
			$.ajax({
				url: $rootScope.base_url+'/hosts/edit',
				type: 'POST',
				data: dataSend,
				complete:function(response){
					$rootScope.set_errors_modal(response.responseJSON,'hostEdit');
					$timeout(function(){
						if(response.responseJSON.status == '1'){
							//Send event to analytics
							if ($rootScope.run_analytics){
								ga('send', {
									hitType: 'event',
									eventCategory: 'AccessPoint',
									eventAction: 'Rename Host',
									eventLabel: 'Renomear Ativo de Rede'
								});
							}
							self.reloadAccessPoint(self.accessPointOpened);
						}
					});					
				}
			});
		},
	    
		addSplitterConfirm : function(){
			dataSend = {};
			dataSend.direction = '0';
			dataSend.access_point_id = self.accessPointOpened.id,
			dataSend.connected_dio_id = $rootScope.form.connected_dio_id;
			dataSend.splitter = {};
			dataSend.splitter.name = $rootScope.form.name;
			dataSend.splitter.type = $rootScope.form.type;
			dataSend.splitter.ports_number = $rootScope.form.ports_number;
			self.isLoading = true;
			if (dataSend.splitter.type == 0){
				//Para splitter desbalanceado, deve mandar porcentagens tambem
				dataSend.splitter.out_one = $rootScope.form.out_one.toFixed(2);
				dataSend.splitter.out_two = $rootScope.form.out_two.toFixed(2);
			}
			if (dataSend.splitter.type == 4){
				//Para splitter com duas entradas, deve mandar descrição da entrada IN 2
				dataSend.splitter.in_two = $rootScope.form.in_two || '';
			}
			if (self.editing_splitter){
				link = $rootScope.base_url+'/access_points/edit_splitter';
				dataSend.id = $rootScope.form.id;
				dataSend.side = $rootScope.form.side;				
			} else {
				link = $rootScope.base_url+'/access_points/add_splitter';
				dataSend.side = 'left';
			}
			$.ajax({
				url: link,
				type: 'POST',
				data: dataSend,
				complete:function(response){
					$rootScope.set_errors_modal(response.responseJSON,'splitterAdd');
					$timeout(function(){
						if(response.responseJSON.status == '1'){

							if(!$rootScope.form.connected_dio_id){
								$rootScope.dialogService.cancel('accessPoint');
								self.openAccessPoint(self.accessPointOpened);
							}else{
								self.traySplitterConnect($rootScope.form.tray_id,response.responseJSON.data);
							}
							
							self.editing_splitter = false;
							self.isLoading = false;							
						}
					});					
				}
			});
		},
		
		otdr : function(slot){
			self.otdrSlot = slot;
			
			var options = {
				autoOpen: false,
				modal: true,
				title: "OTDR",
				width: 450,
				height: 'auto',
				resizable:false,
				close:function(){
					$rootScope.form = [];
					$rootScope.form.error = [];
					self.otdrSlot = [];
				}
			};
			model = [];  
			$rootScope.form = [];
			$rootScope.form.error = [];
			$rootScope.dialogService.open('requestOtdr','requestOtdr', model, options);
		},
	
		moveConnUp : function(connection){
			if (!self.firstConn(connection)){
				dataSend = {},
				dataSend.connection_id = connection.id;
				dataSend.access_point_id = self.accessPointOpened['id'];
				console.log(dataSend);
				console.log(connection);
				self.isLoading = true;
				$.ajax({
					url: $rootScope.base_url+'/access_points/move_conn_up',
					type: 'POST',
					data: dataSend,
					success:function(response){
						// console.log(response); // debug
						if (response.status == 1){
							$rootScope.dialogService.cancel('accessPoint');
							self.openAccessPoint(self.accessPointOpened).then(function(){
								self.isLoading = false;	
							});
						} else {
							self.isLoading = false;	
						}
						$rootScope.$apply();
					},
					complete:function(response){
					}
				});
			}
		},
		
		firstConn : function(connection){
			if ((connection.draw_seq == 100) || (connection.draw_seq == 200)){
				return true;
			}
			return false;
		},
		
		moveConnDown : function(connection){
			dataSend = {},
			dataSend.connection_id = connection.id;
			dataSend.access_point_id = self.accessPointOpened['id'];
			console.log(dataSend);
			console.log(connection);
			self.isLoading = true;
			$.ajax({
				url: $rootScope.base_url+'/access_points/move_conn_down',
				type: 'POST',
				data: dataSend,
				success:function(response){
					// console.log(response); // debug
					if (response.status == 1){
						$rootScope.dialogService.cancel('accessPoint');
						self.openAccessPoint(self.accessPointOpened).then(function(){
							self.isLoading = false;	
						});
					} else {
						self.isLoading = false;	
					}
					$rootScope.$apply();
				},
				complete:function(response){
				}
			});
		},

		moveHostUp : function(host){
			dataSend = {},
			dataSend.host_id = host.id;
			dataSend.access_point_id = self.accessPointOpened['id'];
			self.isLoading = true;
			$.ajax({
				url: $rootScope.base_url+'/hosts/move_host_up',
				type: 'POST',
				data: dataSend,
				success:function(response){
					if (response.status == 1){
						self.reloadAccessPoint(self.accessPointOpened);
					} else {
						self.isLoading = false;	
					}
					$rootScope.$apply();
				},
				complete:function(response){
				}
			});
		},

		moveHostDown : function(host){
			dataSend = {},
			dataSend.host_id = host.id;
			dataSend.access_point_id = self.accessPointOpened['id'];
			self.isLoading = true;
			$.ajax({
				url: $rootScope.base_url+'/hosts/move_host_down',
				type: 'POST',
				data: dataSend,
				success:function(response){
					if (response.status == 1){
						self.reloadAccessPoint(self.accessPointOpened);
					} else {
						self.isLoading = false;	
					}
					$rootScope.$apply();
				},
				complete:function(response){
				}
			});
		},
		
		changeSide : function(connection){
			self.isLoading = true;
			$.ajax({
				url: $rootScope.base_url+'/access_points/change_connection_side',
				type: 'POST',
				data: {connection_id:connection, access_point_id:self.accessPointOpened.id},
				complete:function(response){
					$rootScope.dialogService.cancel('accessPoint');
					// Fusions.space = 0;
					self.openAccessPoint(self.accessPointOpened);
				}
			});

		},

		
		findHostTypes : function(){ 	
			self.host_types = [];	
			$http.post( $rootScope.base_url+'/host_types/list_all').success(function(data){		
				self.host_types = data;		      	
			});	
		},

		
		//MANTENDO FUNCAO ANTIGA (DEMORADA) PARA ABRIR PONTO DE ACESSO, SOH POR SEGURANCA.
		openAccessPointOld : function(accessPoint,element){
			Map.map.setOptions({ draggableCursor: 'wait' });
			self.createConnections(accessPoint).then(
				function(data){
					self.connections = data;
					self.createHosts(accessPoint).then(function(hosts){						
						self.hosts = hosts;
						var options = {
							autoOpen: false,
							modal: true,
							title: $rootScope.Users.translateText('Ponto de acesso: ')+accessPoint.name,
							width: '1200',
							height:'600',
							dialogClass: "accessPoint", 
							resizable:false,
							create: function (event, ui) {
								$(event.target).parent().css('position', 'fixed');
							},      				
							close:function(){
								$rootScope.accessPointOpen = false;     
								Fusions.paths = [];
								Fusions.white_stripe_paths = [];
								Fusions.black_stripe_paths = [];
								Fusions.circles  = [];
								Fusions.cont_slots = 0;
								Fusions.source = false;
								Fusions.target = false;
								Fusions.dataSend = false;
								Fusions.conn_in = false;
								Fusions.conn_out = false;
								Fusions.space = 0;
							}
						};
						model = [];  
						self.accessPointOpen = true; 
						self.accessPointOpened = accessPoint; 
						


						$rootScope.dialogService.open('accessPoint','accessPoint', model, options).then(function(){

							$timeout(function() {
								//pegar o tamanho pelo tamanho do scroll da modal
							    var altCaixaEmenda = $('#containerAccessPoint').prop('scrollHeight');
							    $('#svgAccessPoint').css('height',altCaixaEmenda);

								Fusions.drawFusions(self.connections);
								Fusions.drawFusionsHost(self.hosts);
								Map.map.setOptions({ draggableCursor: 'crosshair' });
							}, 300);
						});
						Map.map.setOptions({ draggableCursor: 'crosshair' });
					})
				},function(){
					Map.map.setOptions({ draggableCursor: 'crosshair' });
					$rootScope.alert_message('<h6>Falha ao criar connexões</h6>');
				}
			)
		},

        openAccessPoint: function(accessPoint){

			self.createDios(accessPoint).then(function(dios){
				self.dios = dios;
				//Caso haja DIO no ap carrega novo layout
				if(!jQuery.isEmptyObject(self.dios)){
					self.originalApShow = false;
				}

				if (!self.originalApShow) {
					self.openAccessPointNewLayout(accessPoint);
				} else {
					self.openAccessPointMisturado(accessPoint);
				}
			
			});
        },

        /**
         * 
         * @param {any} accessPoint 
         */
        openAccessPointNewLayout : async function(accessPoint){
            self.isLoading = false;
            $rootScope.loadingApVisualizer = true;

            //Send event to analytics
			if ($rootScope.run_analytics){
				ga("send", {
					hitType: "event",
					eventCategory: "AccessPoint",
					eventAction: "open",
					eventLabel: "Caixa"
				});
			}

            // Set shared database flag if ap is from another db
            self.sharedDatabase = accessPoint.sharedDatabase ? accessPoint.sharedDatabase : "";

            // Open modal / dialog
            self.createAndOpenApModal(accessPoint);

            // Carregar conexões, e preparar dados
            let connections = await self.createConnections(accessPoint);
            self.connections = connections; // TODO Temporary - this is here because loadReportsAnimate uses it
            self.isLoading = false;
            //console.log("Loaded connections with await;", connections);

            // Carregar hosts, e preparar dados
            let hosts = await self.createHosts(accessPoint);
            self.hosts = hosts; // TODO Temporary - this is here because loadReportsAnimate uses it
            //console.log("Loaded hosts with await:", hosts);

            // Carregar DIOs, e preparar dados
            let dios = await self.createDios(accessPoint);
			self.dios = dios;
            //console.log("Loaded dios with await:", dios);

            // Set loss values on slots
            self.setDataOnSlots(self.connections);

            self.apVisualizerLoadingFiberReports = true;
            await Fusions.loadReportsAnimate(accessPoint);
            //console.log("Loaded fiber reports with await");

            // Finalizar flag de carregamento, e instanciar apVisualizer com dados gerados
            $rootScope.loadingApVisualizer = false;
            $rootScope.$apply();
            self.initializeApVisualizer(connections, hosts, dios);

            self.isLoading = false;
        },

        

        /**
         * Set the loss on all slots that have a connected fusion.
         * @param {any[]} connections 
         */
        setDataOnSlots: function (connections) {
            //usado para desenhar as linhas ao abrir a caixa;
            angular.forEach(connections.fusions, function (el, index) {
                if (el && !el.hideTube) {
                    self.setSlotData(el.loss, el.access_point_connection_id_in, el.fiber_in, el.connection_type);
                    self.setSlotData(el.loss, el.access_point_connection_id_out, el.fiber_out, el.connection_type);
                }

            });
        },

        /**
         * Given a connection id and fiber number,
         * set the given loss value on that slot. 
         * @param {number} loss 
         * @param {number} conn_id 
         * @param {number} fiber 
         * @returns 
         */
        setSlotData: function (loss, conn_id, fiber,connection_type) {
            var d = $q.defer();
            // let slotId = conn_id + "_" + fiber;
            angular.forEach(self.connections.connectionsLeft, function (conn, indexConn) {
                if (conn && conn.id == conn_id) {
                    angular.forEach(conn.slots, function (slotConn, indexSlot) {
                        if (slotConn.connection_id === conn_id && slotConn.fiber === fiber) {
                            self.connections.connectionsLeft[indexConn].slots[indexSlot]['fusion_loss'] = loss;
                            self.connections.connectionsLeft[indexConn].slots[indexSlot]['connected'] = 1;
                            self.connections.connectionsLeft[indexConn].slots[indexSlot]['connection_type'] = connection_type;
                            d.resolve();
                        }
                    })
                }
            });
            angular.forEach(self.connections.connectionsRight, function (conn, indexConn) {
                if (conn && conn.id == conn_id) {
                    angular.forEach(conn.slots, function (slotConn, indexSlot) {
                        if (slotConn.connection_id === conn_id && slotConn.fiber === fiber) {
                            self.connections.connectionsRight[indexConn].slots[indexSlot]['fusion_loss'] = loss;
                            self.connections.connectionsRight[indexConn].slots[indexSlot]['connected'] = 1;
                            self.connections.connectionsRight[indexConn].slots[indexSlot]['connection_type'] = connection_type;
                            d.resolve();
                        }
                    })
                }
            });
            return d.promise;
        },

        /**
         * 
         * @param {any} accessPoint
         */
        createDios : function(accessPoint){
            var d = $q.defer();
            setTimeout(() => {
                d.resolve([]);
            }, 1);
            return d.promise;
        },

        /**
         * 
         * @param {any} accessPoint
         */
        createAndOpenApModal: function(accessPoint){
            var options = {
                autoOpen: false,
                modal: true,
                title: $rootScope.Users.translateText("Ponto de acesso: ")+accessPoint.name,
                width: "100%",
                height: $(window).height() - 15,
                position: { my: "left top", at: "left top", of: window },
                dialogClass: "accessPoint", 
                resizable:true,
                responsive: true,
                create: function (event, ui) {
                    // TODO What is this line for?
                    $(event.target).parent().css('position', 'fixed');
                    $(".accessPoint").draggable(false);
                },			
                close:function(){
                    self.cleanupAccessPointData(accessPoint);
					// Limpar o conteúdo dos elementos pelos IDs
					document.getElementById("signal-tooltip").innerHTML = "";
					document.getElementById("client-name-tooltip").innerHTML = "";
					document.getElementById("context-menu-svg").innerHTML = "";

                }
            };
            model = [];  
            self.accessPointOpen = true; 
            self.accessPointOpened = accessPoint;
            self.hideTube = false;
            self.tubeConnect = [];
            $rootScope.dialogService.open('accessPoint','accessPoint', [], options);
        },

        /**
         * @param {any} accessPoint 
         */
        cleanupAccessPointData: function(accessPoint){
            Fusions.cancelApRequests(accessPoint.id);
            $rootScope.accessPointOpen = false;
            self.connectionsOrHostsLeft = false;
            Map.map.setOptions({ draggableCursor: 'crosshair' });
            self.accessPointConnectionsTemp = null;
            self.connections = [];
            self.hosts = [];
            Fusions.paths = [];
            Fusions.white_stripe_paths = [];
            Fusions.black_stripe_paths = [];
            Fusions.circles  = [];
            Fusions.cont_slots = 0;
            Fusions.source = false;
            Fusions.target = false;
            Fusions.dataSend = false;
            Fusions.conn_in = false;
            Fusions.conn_out = false;
            Fusions.space = 0;
            Fusions.reloadRoutes = false;
            Fusions.highlightingFusion = false;
            $rootScope.height_ap = "";
            self.isLoading = false;
            $rootScope.Fusions.isLoading = false;
            self.originalApShow = false;
            $rootScope.Fusions.fusionsInLoading = [];
        },

		//Funcao que primeiramente abre a modal, e ai carrega o conteudo do ponto de acesso.
		openAccessPointMisturado : function(accessPoint,element){
            console.log("openAccessPointMisturado");
			//Calculate time
			var start_ap_load = new Date().getTime();

			//Send event to analytics
			if ($rootScope.run_analytics){
				ga('send', {
					hitType: 'event',
					eventCategory: 'AccessPoint',
					eventAction: 'open',
					eventLabel: 'Caixa'
				});
			}

			//Cancel previous pre-loading interval, to open current access point as fast as possible;
			$interval.cancel(self.preLoadAccessPoints);

			Map.map.setOptions({ draggableCursor: 'wait' });
			//Variaveis para disparar spinners
			self.connections_done = false;
			self.hosts_done = false;
			//usado para colocar em readonly
			if(accessPoint.sharedDatabase){
				self.sharedDatabase = accessPoint.sharedDatabase;
			}else{
				self.sharedDatabase = "";
			}
			var options = {
					autoOpen: false,
					modal: true,
					title: $rootScope.Users.translateText('Ponto de acesso: ')+accessPoint.name,
					width: "1232px",
					height: "600",//$(window).height() - 15 ,
					//position: { my: "left top", at: "left top", of: window },
					dialogClass: "accessPoint", 
					resizable:true,
					responsive: true,
					create: function (event, ui) {
						$(event.target).parent().css('position', 'fixed');
						$(".accessPoint").draggable(false);
						//criando botao maximizar
						$(this).parent().find('.ui-dialog-titlebar').append("<div id='btn_max_ap'><img src=" + $rootScope.base_url+"/img/icons_map/height.svg /></div>");
						$("#btn_max_ap").click(function(){
							//armazena height e maximiza
						 	if (!$rootScope.height_ap){
						 		$rootScope.height_ap = parseInt($(".accessPoint").css('height'));
						 		$("#containerAccessPoint").css('height', '94.5%');
						 		$(".accessPoint").css('height', '97.1%');
						 	}else{
						 		$("#containerAccessPoint").css('height', $rootScope.height_ap - 43);
						 		$(".accessPoint").css('height', $rootScope.height_ap);
						 		$rootScope.height_ap = "";
						 	}
						   
						   setTimeout(function() {
								$(window).trigger('resize');
							}, 100);
						});
					},			
					close:function(){
                        Fusions.cancelApRequests(accessPoint.id);
                        
						$rootScope.accessPointOpen = false;
						self.connectionsOrHostsLeft = false;
						Map.map.setOptions({ draggableCursor: 'crosshair' });
						self.accessPointConnectionsTemp = null;
						self.connections = [];
						self.hosts = [];
						self.dios = [];
						Fusions.paths = [];
						Fusions.white_stripe_paths = [];
						Fusions.black_stripe_paths = [];
						Fusions.circles  = [];
						Fusions.cont_slots = 0;
						Fusions.source = false;
						Fusions.target = false;
						Fusions.dataSend = false;
						Fusions.conn_in = false;
						Fusions.conn_out = false;
						Fusions.space = 0;
						Fusions.reloadRoutes = false;
						Fusions.highlightingFusion = false;
						$rootScope.height_ap = "";
						self.isLoading = false;
						$rootScope.Fusions.isLoading = false;
						self.originalApShow = true;
						$rootScope.Fusions.fusionsInLoading = [];

						// Limpar o conteúdo dos elementos pelos IDs
						document.getElementById("signal-tooltip").innerHTML = "";
						document.getElementById("client-name-tooltip").innerHTML = "";
						document.getElementById("context-menu-svg").innerHTML = "";

					}
			};
			model = [];  
			self.accessPointOpen = true; 
			self.accessPointOpened = accessPoint;
			self.hideTube = false;
			self.tubeConnect = [];
			$rootScope.dialogService.open('accessPoint','accessPoint', model, options);
			

            // Temp - 12/09/2023 - Mostrando dica do novo Layout
            if (!self.hasShownNewLayoutTip){
                let interval = setInterval(() => {
                    if (!$rootScope.Connections.isLoading && !$rootScope.Fusions.isLoading){
                        $rootScope.Tips.showNewApLayoutTip();
                        self.hasShownNewLayoutTip = true;
                        clearInterval(interval);
                    }
                }, 250);
            }

			//Apos abrir modal, chama funcao para criar conexoes
			self.createConnections(accessPoint, false).then(
					function(data){
						self.connections = data;
						//For spinner
						self.connections_done = true;
						//Criar Hosts
						self.createHosts(accessPoint).then(function(hosts){						
							self.hosts = hosts;
							//For spinner
							self.hosts_done = true;	

							//esse timeout serve para esperar as connections serem desenhadas,
							//para depois disso desenhar as fusions.
							$timeout(function() {
								//pegar o tamanho pelo tamanho do scroll da modal
								var altCaixaEmenda = $('#containerAccessPoint').prop('scrollHeight');
								self.correctClientConnsPosition(altCaixaEmenda);
								$('#svgAccessPoint').css('height',altCaixaEmenda);
								Fusions.drawFusions(self.connections);
								Fusions.drawFusionsHost(self.hosts);
								Map.map.setOptions({ draggableCursor: 'crosshair' });
								//Deleta "space" em fusions, para nao aumentar o espaco desnecessariamente
								Fusions.space = 0;
								Fusions.loadReportsAnimate(accessPoint).then(function(){
									self.isLoading = false;

									$rootScope.Fusions.isLoading = false;

                                    if (!self.originalApShow){
									    self.setApVisualizer();
                                    }

									//Calculate time
									var finished_ap_load = new Date().getTime();
									var complete_ao_load_time = finished_ap_load - start_ap_load;
									//console.log("Carregou conexoes em " + ((complete_ao_load_time/1000).toFixed(2)) + " segundos");
									//Pre-Load neighbors
									//self.preLoadNeighbors(accessPoint.id);
								});
							}, 100);
						});
					});
		},

        dioOpenNewWindow: function(dioId){
            window.open($rootScope.base_url + "/dios/render_dio/" + dioId, '_blank').focus();
        },

		dioOpen: function(dio){
            var options = {
                autoOpen: false,
                modal: true,
                title: $rootScope.Users.translateText("Dio: ")+dio.name,
                width: "100%",
                height: $(window).height() - 15,
                position: { my: "left top", at: "left top", of: window },
                dialogClass: "dio", 
                resizable:true,
                responsive: true,
                create: function (event, ui) {
                    // TODO What is this line for?
                    $(event.target).parent().css('position', 'fixed');
                    $(".accessPoint").draggable(false);
					$rootScope.apVisualizer.dioOpened = true;
                },			
                close:function(){
					// Limpar o conteúdo dos elementos pelos IDs
					document.getElementById("signal-tooltip").innerHTML = "";
					document.getElementById("client-name-tooltip").innerHTML = "";
					document.getElementById("context-menu-svg").innerHTML = "";
					$(".dio-svg").innerHTML = "";
					self.dioPortConnectionData = [];
					self.dioTrayConnectionData = [];
					$rootScope.apVisualizer.dioOpened = false;
					self.cont_slots = 0;
					self.dioOpened = null;
                }
            };
            model = [];


			self.dioUpdateConnections(dio);
			
			self.dioOpened = dio;

			$timeout(function(){
				
				self.filteredConnections = $rootScope.apVisualizer.accessPointData.cableConnections.filter(function(conn) {
				    return !self.dioOpened.dio_connections.find(c => c.cable_id === conn.cable_id);
				});

				self.drawDioCableSvgs(dio.dio_trays);

				// self.drawDioLineSvgs(dio.dio_ports);
				
			}, 100);			
			
            $rootScope.dialogService.open('dio','dio', [], options);

			// Draw all cable svgs, after the window is loaded
			

        },

		dioUpdateConnections: function(dio){

			// Copiar as conexões de cabo de accessPointData para dioOpened.dio_connections se elas não existirem lá
			$rootScope.apVisualizer.accessPointData.cableConnections.filter(cn => cn && !cn.host_type_id).forEach(conn => {
				var find = dio.dio_connections.findIndex(t => conn.cable_id ? t.cable_id === conn.cable_id
					: t.splitter_id === conn.splitter_id);
                if (find >= 0) {

					if(conn.cable_id){

						//montando array de tubos
						conn.tubes = [];
						for (let i = 1; i <= conn.cable.cable_type.tubes; i++) {
						    
							conn.tubes.push(self.tubeColorCode[conn.cable.cable_type.code_color][i]);
						
						}
						
					}

					//verificar slots conectados
					for(slot of conn.slots){
						slot.connected = self.isDioConnected(slot);
					}


                    dio.dio_connections[find] = conn;
                };
			});

			
		},

        /**
         * Unset Route Caches for Ap
         * Sends a request to the backend, to set all route caches
         * for this access point as invalid
         */
        unsetRouteCachesForAp : function(accessPoint){
            //GET THE CONNECTIONS
			link = $rootScope.base_url+"/access_points/remove_route_cache_for_ap";
			var ap_connections;
			$.ajax({
				url: link,
				type: "POST",
				data: {id:accessPoint.id},
				success:function(data){
                    console.log("success:", data);
                    console.log("reloading access point");
					self.reloadAccessPoint(accessPoint);
				}
			});
        },
		
		//Método que recarrega todos os elementos de uma caixa, sem a necessidade fechar a janela e abrir novamente
		reloadAccessPoint : function(accessPoint, element){
			var start_ap_load = new Date().getTime();

			self.connectionsOrHostsLeft = false;
			self.accessPointConnectionsTemp = null;
			self.connections = [];
			self.hosts = [];
			Fusions.paths = [];
			Fusions.white_stripe_paths = [];
			Fusions.black_stripe_paths = [];
			Fusions.circles  = [];
			Fusions.cont_slots = 0;
			Fusions.source = false;
			Fusions.target = false;
			Fusions.dataSend = false;
			Fusions.conn_in = false;
			Fusions.conn_out = false;
			Fusions.space = 0;
			Fusions.reloadRoutes = true;
			self.hideTube = false;
			self.tubeConnect = [];
			self.createConnections(accessPoint, false).then(
					function(data){
						self.connections = data;
						//For spinner
						self.connections_done = true;
						//Criar Hosts
						self.createHosts(accessPoint).then(function(hosts){						
							self.hosts = hosts;
							//For spinner
							self.hosts_done = true;	

							//esse timeout serve para esperar as connections serem desenhadas,
							//para depois disso desenhar as fusions.
							$timeout(function() {
								//pegar o tamanho pelo tamanho do scroll da modal
								var altCaixaEmenda = $('#containerAccessPoint').prop('scrollHeight');
								self.correctClientConnsPosition(altCaixaEmenda);
								$('#svgAccessPoint').css('height',altCaixaEmenda);
								Fusions.drawFusions(self.connections);
								Fusions.drawFusionsHost(self.hosts);
								Map.map.setOptions({ draggableCursor: 'crosshair' });
								//Deleta "space" em fusions, para nao aumentar o espaco desnecessariamente
								Fusions.space = 0;
								Fusions.loadReportsAnimate(accessPoint).then(function(){
									self.isLoading = false;

									self.setApVisualizer();
									
									//Calculate time
									var finished_ap_load = new Date().getTime();
									var complete_ao_load_time = finished_ap_load - start_ap_load;
									//console.log("Carregou conexoes em " + ((complete_ao_load_time/1000).toFixed(2)) + " segundos");
									//Pre-Load neighbors
									//self.preLoadNeighbors(accessPoint.id);
								});
							}, 100);
						});
					});
		},

		hideTubes : function(connection,selectedSlot){
            
            //ao esconder primeiro tubo exibe msg
            if(!self.hideTube){
				var options = {
						autoOpen: false,
						modal: true,
						title: $rootScope.Users.translateText('Atenção'),
						width: 300,
						height:'auto',
						resizable:true,
						dialogClass: "noclose", 
				};
				$rootScope.messageAlert = $rootScope.Users.translateText('Existem tubos econdidos. Para exibir todos, clique em Recarregar');
					model = [];  
				$rootScope.dialogService.open('alertModal','alertModal', model, options).then();

				setTimeout(function(){
					// Only try to close if dialog is open
					if ($rootScope.dialogService.isOpen('alertModal')){
						$rootScope.dialogService.cancel('alertModal');
					}
				}, 2000);
            }
				        
	        //limpando pois serão recriados de acordo com slots visiveis
	        Fusions.paths = [];
			Fusions.white_stripe_paths = [];
			Fusions.black_stripe_paths = [];
			Fusions.circles  = [];
			Fusions.cont_slots = 0;
			Fusions.source = false;
			Fusions.target = false;
			Fusions.dataSend = false;
			Fusions.conn_in = false;
			Fusions.conn_out = false;
			Fusions.space = 0;
			Fusions.reloadRoutes = false;
			self.hideTube = true;

			var fibersByTube = (connection.cable.cable_type.number_fibers/connection.cable.cable_type.tubes);

			for(s of connection.slots){

				//verifica se faz parte do mesmo tubo do slot clicado
				if((Math.floor((s.fiber - 1) / (fibersByTube))) === (Math.floor((selectedSlot.fiber - 1) / (fibersByTube)))){

					s.hideTube = true;

					//esconder portas
					self.hosts.filter(c2 => c2.ports.filter(s2 => s2.connection_id === s.connection_id 
						&& s2.fiber === s.fiber).forEach(port =>{
							port.hideTube = true;
						}));

                    //buscando fusao do slot escondido para esconder slot correspondente
					connections.fusions.filter(fus => fus && ((fus.access_point_connection_id_in ===  s.connection_id
						&& fus.fiber_in === s.fiber)|| (fus.access_point_connection_id_out ===  s.connection_id
						&& fus.fiber_out === s.fiber))).forEach(fusao =>{

                        //identificando fibra q sera escondida tambem
						var connId = 0,fiberId = 0;
						if(fusao.access_point_connection_id_in === s.connection_id){
							connId = fusao.access_point_connection_id_out;
							fiberId = fusao.fiber_out; 
							if(fusao.fiber_in === s.fiber){
								fusao.hideTube = true;     
							}  
						}else{
							connId = fusao.access_point_connection_id_in;
							fiberId = fusao.fiber_in;
							if(fusao.fiber_out === s.fiber){
								fusao.hideTube = true;     
							}
						}

                        //esconder cada slot conectado
						connections.connectionsLeft.filter(c2 => c2.slots.filter(s2 => s2.connection_id === connId 
						    && s2.fiber === fiberId).forEach(slot2 =>{
								slot2.hideTube = true;
							}));

						connections.connectionsRight.filter(c2 => c2.slots.filter(s2 => s2.connection_id === connId 
						    && s2.fiber === fiberId).forEach(slot2 =>{
								slot2.hideTube = true;
							}));

					 });

				}

			}			

			//animar fibra com sinal
			connections.connectionsLeft.filter(c2 => c2.slots.filter(s2 => s2).forEach(slot =>{

				if(!slot.hideTube){							
					animateFiber(slot);
				}

			}));

			connections.connectionsRight.filter(c2 => c2.slots.filter(s2 => s2).forEach(slot =>{

				if(!slot.hideTube){	
					animateFiber(slot);
				}

			}));

            $timeout(function(){
               //desenhar fusoes dos slots que nao estao escondidos
				Fusions.drawFusions(connections);
				Fusions.drawFusionsHost(self.hosts);
			},100);

			function animateFiber(slot){

			connections.fusions.filter(fus => fus && ((fus.access_point_connection_id_in ===  slot.connection_id
			&& fus.fiber_in === slot.fiber)|| (fus.access_point_connection_id_out ===  slot.connection_id
			&& fus.fiber_out === slot.fiber))).forEach(fusao =>{

                    if(slot.report_data){
					if(slot.report_data.active){
						fusao.active = true;
					}
				}

				var savedFusion = self.savedReportsFusions.find(f => f.fusion.id === fusao.id.toString());
				if(savedFusion){
					fusao.data_direction = savedFusion.fusion.data_direction;	
				}		

				});

				if(slot.report_data){
					if(slot.report_data.active){
				        slot.report_data.active =true;
					}
			}else{
				slot.report_data = false;
		   	}

			Fusions.drawFiberTip(slot.fiber, null, slot.connection_id, slot.report_data);

			}

		},

		connectTube : function(connection,selectedSlot){

			var firstClick = !self.tubeConnect.length ? true : false;

			var curr = firstClick ? "currentSource" : "currentTarget";
			var numSlot = firstClick ? "source" : "target";

			var fibersByTube = (connection.cable.cable_type.number_fibers/connection.cable.cable_type.tubes);

            //caso seja click no mesmo tubo, limpa array para cancelar
            if(connection.slots.find(c=>(Math.floor((c.fiber - 1) / (fibersByTube))) === (Math.floor((selectedSlot.fiber - 1) / (fibersByTube))) && c.tubeConnect)){
				connection.slots.filter(c=>(Math.floor((c.fiber - 1) / (fibersByTube))) === (Math.floor((selectedSlot.fiber - 1) / (fibersByTube))) && c.tubeConnect).forEach(slot =>{
                    slot.tubeConnect = false;
				});
				self.tubeConnect = [];
				return;
			}

			var qtdSlotsTube = connection.slots.filter(c=>(Math.floor((c.fiber - 1) / (fibersByTube))) === (Math.floor((selectedSlot.fiber - 1) / (fibersByTube)))).length;

			if(!firstClick && (qtdSlotsTube !== self.tubeConnect.length)){
				$rootScope.alert_message($rootScope.Users.translateText('Quantidade de slots diferente do tubo selecionado'));
				return;
			}

            //se ja houver fusoes não faz nada
			if(connection.slots.find(c=>(Math.floor((c.fiber - 1) / (fibersByTube))) === (Math.floor((selectedSlot.fiber - 1) / (fibersByTube))) && (("direction" in c) || c.connected))){
				$rootScope.alert_message($rootScope.Users.translateText('Já existem fusões nesse tubo'));
				return;
			}

			var cont = 0;

            //junta slots que farao fusoes
			//verificando se faz parte do mesmo tubo do slot clicado
			connection.slots.filter(c=>(Math.floor((c.fiber - 1) / (fibersByTube))) === (Math.floor((selectedSlot.fiber - 1) / (fibersByTube)))).forEach(slot =>{
				
				if(!self.tubeConnect[cont]){
				    self.tubeConnect[cont] = [];
				}
				var context = angular.element(document.getElementById(slot.connection_id+'_'+slot.fiber)).context;
				self.tubeConnect[cont][numSlot] = slot;
				self.tubeConnect[cont][numSlot].Y = context.offsetTop + context.offsetParent.offsetTop; 
                self.tubeConnect[cont][numSlot].X = context.offsetWidth;
				slot.tubeConnect = true;

				cont++;
				
			});

			if(!firstClick){

                //funcao que cria fusoes
				$rootScope.Fusions.connectMany();

			}

		},

		preLoadNeighbors : function(accessPointId){
			//Turn it into an asynchronous method
			var d = $q.defer();
			$timeout(function() {
				
				//GET ALL SURROUNDING ACCESS POINTS
				self.preload_list = [];
				angular.forEach(self.connections['connectionsLeft'], function(connection, index){
					angular.forEach(connection.cable.dots, function(dot, dot_index){
						if (dot.access_points.length > 0){
							if ((dot.access_points[0].id != accessPointId) && (!itemInArray(dot.access_points[0].id, self.preload_list))){
								self.preload_list.push(dot.access_points[0].id);
							}
						}
					});
				});
				angular.forEach(self.connections['connectionsRight'], function(connection, index){
					angular.forEach(connection.cable.dots, function(dot, dot_index){
						if (dot.access_points.length > 0){
							if ((dot.access_points[0].id != accessPointId)  && (!itemInArray(dot.access_points[0].id, self.preload_list))){
								self.preload_list.push(dot.access_points[0].id);
							}
						}
					});
				});
				//------------------------------------
				
				//In an interval, load the report data for each access point, based on the ID!
				
				self.preLoadIndex = 0;
				self.neighborsLoaded = 0;
                self.preLoadAccessPoints = $interval(function() {
             	   	//Call func to reload
             	   	self.preLoadApByIndex();
                }, 6500);
				d.resolve(null);
			}, 0);
			return d.promise;
		},
		
		preLoadApByIndex : function(){
			var index = self.preLoadIndex;
			self.preLoadIndex = self.preLoadIndex + 1;
			//Load only three neighbors max
			if ((self.neighborsLoaded >= 2) || (index >= self.preload_list.length)){
				$interval.cancel(self.preLoadAccessPoints);
				return;
			}
			if (!itemInArray(self.preload_list[index], self.access_points_preloaded)){
				self.preloadById(self.preload_list[index]);
				self.neighborsLoaded++;
			}
		},
		
		getAccessPointConnections : function(ap_id){
			//GET THE CONNECTIONS
			link = $rootScope.base_url+'/access_points/get_connections_no_report';
			var ap_connections;
			$.ajax({
				url: link,
				type: 'POST',
				data: {id:ap_id},
                headers: {
                    'X-CSRF-Token': $rootScope.getCookie('csrfToken')
                },
				async: false,
				success:function(connections){
					ap_connections = connections;
				}
			});
			return ap_connections;
		},
		
		preloadById : function(ap_id){
			
			//GET THE CONNECTIONS
			link = $rootScope.base_url+'/access_points/get_connections_no_report';
			$.ajax({
				url: link,
				type: 'POST',
				data: {id:ap_id},
                headers: {
                    'X-CSRF-Token': $rootScope.getCookie('csrfToken')
                },
				success:function(connections){
					
					$.ajax({
		                url: $rootScope.base_url+'/access_points/list_fusions',
		                type: 'POST',
		                data: {id:ap_id},
		                success:function(response){
		                	angular.forEach(response, function(fusion, index_fusions){
								$timeout(function() {
									//console.log("EIIIOOOOO");
			                    	index = $rootScope.Fusions.reportAvailable(fusion)
			                    	if (index == -1){
			                    		//Report is not available, so load it!
			            	        	$.ajax({
			            	                url: $rootScope.base_url+'/access_points/complete_fusion_report',
			            	                type: 'POST',
			            	                data: {fusion:fusion},
			            	                success:function(report){
			            						$rootScope.Fusions.saveReportFusion(report);
			            	                }
			            	        	});
			                    	}
								}, 1000 * index_fusions);
		                	});
		                	
		                	//SLOTS WITH NO FUSION
		                	angular.forEach(connections, function(conn, index_conn){
		                		if (conn.cable){
		                			number_fibers = conn.cable.cable_type.number_fibers;
		                		} else if (conn.splitter){
		                			number_fibers = conn.splitter.ports_number;
		                		} else {
		                			return;
		                		}
		                		var i;
		                		for (i = 1; i <= number_fibers; i++){
		                			if (!self.findFusionByFiberNumber(conn, i)){
		                				//Load that slot
		                				var fiber_number = i;
		                	        	$.ajax({
		                	                url: $rootScope.base_url+'/access_points/fiber_report',
		                	                type: 'POST',
		                	                data: {fiber_number:fiber_number, access_point_id:ap_id, connection_id:conn.id},
		                	                success:function(response){
		                						//Save report for further use
		                	                	$rootScope.Fusions.saveReportSlot(response.fiber_number, conn.id, response);
		                					}
		                	        	});
		                			}
		                		}
		                	});
		                	console.log("PRELOADED AP: " + ap_id);
		                	self.access_points_preloaded.push(ap_id);
		                }
		            });
				}
			});
			
		},
		
		/**
		 * Actually just checks if the fusion is there
		 * */
		findFusionByFiberNumber : function(conn, fiber_number){
			var i;
			for (i = 0; i < conn.fusions_in.length; i++){
				if ((conn.fusions_in[i].fiber_in == fiber_number) && (conn.fusions_in[i].access_point_connection_id_in == conn.id)){
					return true;
				}
			}
			for (i = 0; i < conn.fusions_out.length; i++){
				if ((conn.fusions_out[i].fiber_out == fiber_number) && (conn.fusions_out[i].access_point_connection_id_out == conn.id)){
					return true;
				}
			}
			return false;
		},
		
		/**
		 * 
		 * */
		correctClientConnsPosition : function(height){
			y_position = height - 85;
			angular.forEach(self.client_connections, function(conn, index_conn){
				if (conn.client){
					conn.y = y_position;
				}
			});
		},
		
		deleteClientConnAp : function(client_id, ap_id){
			self.getApConnections(ap_id).then(function(conns){
				console.log(conns);
				var i;
				for (i = 0; i < conns.length; i++){
					if (conns[i].client_id){
						if (conns[i].client_id == client_id){
							console.log("Will delete connection");
							$.ajax({
								url: $rootScope.base_url+'/access_points/delete_client_connection',
								type: 'POST',
								data: {id: conns[i].id},
								success:function(data){
									if (data.status == 1){
										console.log("deleted!");
									}
								},
							});
							return;
						}
					}
				}
			});
		},
		
		
		getApConnectionsSync : function(ap_id){
			var connections;
			link = $rootScope.base_url+'/access_points/get_connections_no_report';
			$.ajax({
				url: link,
				type: 'POST',
				async: false,
				data: {id:ap_id},
                headers: {
                    'X-CSRF-Token': $rootScope.getCookie('csrfToken')
                },
				success:function(response){
					connections = response;
				},
				error:function(response){
					console.log("ERROR");
					// console.log(response); // debug
				}
			});
			return connections;
		},
		
		getApConnections : function(ap_id){
			var d = $q.defer();
			link = $rootScope.base_url+'/access_points/get_connections_no_report';
			$.ajax({
				url: link,
				type: 'POST',
				data: {id:ap_id},
                headers: {
                    'X-CSRF-Token': $rootScope.getCookie('csrfToken')
                },
				success:function(response){
					d.resolve(response);
				},
				error:function(response){
					console.log("ERROR");
					// console.log(response); // debug
				}
			});
			return d.promise;
		},
		
		sortConnectionsVertically : function(response){			
			response.sort(function(a, b) { 
			    return a.draw_seq - b.draw_seq;
			})
			return response;
		},
		
		createConnections : function(accessPoint, report){
			var d = $q.defer();
			//self.isLoading = true;
			self.client_connections_drawn = 0;
			self.client_connections = [];
			var urlController = accessPoint.sharedDatabase ? "shared_folders" : "access_points";
			if (report){
				link = $rootScope.base_url+'/' + urlController + '/get_connections';
			} else {
				link = $rootScope.base_url+'/' + urlController + '/get_connections_no_report';
			}
			//montar cabos , spliters e equipamentos
			$.ajax({
				url: link,
				type: 'POST',
				data: {id:accessPoint.id, sharedDatabase:accessPoint.sharedDatabase, real_id:accessPoint.real_id, db_tomodat_local: $rootScope.db_tomodat_local},
                headers: {
                    'X-CSRF-Token': $rootScope.getCookie('csrfToken')
                },
				success:function(response){

					// next_ap é protegida vem null do request
					if(accessPoint.sharedDatabase){
						for(ap_con of response){
							if(ap_con.temp_next_ap){
								ap_con.next_ap = ap_con.temp_next_ap;
							}
						}
					}
					
					// console.log(response);
					connections = [];
					connections['fusions'] = [];
					connections['fusionsD3'] = [];
					connections['connectionsLeft'] = [];
					connections['connectionsRight'] = [];
					connections['connectionsBottom'] = [];
					
					//Order connections by "draw_seq"
					response = self.sortConnectionsVertically(response);
					
					///separar oque vai desenhar do lado direito e esquerdo
					angular.forEach(response, function(el,val){

						if(el.cable){
							self.createCableConnection(el);
						}

						if(el.splitter){
							self.createSplitterConnection(el);							
						}
						if(el.client){
							self.createClientConnection(el);
						}


					});

                    $rootScope.$apply();

					self.accessPointConnectionsTemp = connections;
					d.resolve(connections);

				},
				error:function(response){
					d.reject(response);
				}
			});
			
			return d.promise;
		},

		hideCableConnections : function(connection){

			return !$rootScope.apVisualizer.accessPointData.cableConnections.some(function(cableConnection) {
				return cableConnection.cable_id === connection.cable_id;
			});

		},

		onOffNewLayout : function(){

			self.originalApShow = !self.originalApShow;

			if(!self.originalApShow){
                //self.reloadAccessPoint(self.accessPointOpened);
                //Send event to analytics
                if ($rootScope.run_analytics){
                    console.log("Send Analytics - NEW");
                    ga('send', {
                        hitType: 'event',
                        eventCategory: 'AccessPoint',
                        eventAction: 'Go to NEW layout',
                        eventLabel: 'Go to NEW layout'
                    });
                }
				$rootScope.height_ap = parseInt($(".accessPoint").css('height'));
				$("#containerAccessPoint").dialog({position: { my: "left top", at: "left top", of: window },
				width: '100%'});
				$("#containerAccessPoint").css('height', '94.5%');
				$(".accessPoint").css('height', '97.1%');

				self.setApVisualizer();
			} else {
                //Send event to analytics
                if ($rootScope.run_analytics){
                    console.log("Send Analytics - OLD");
                    ga('send', {
                        hitType: 'event',
                        eventCategory: 'AccessPoint',
                        eventAction: 'Go to OLD layout',
                        eventLabel: 'Go to OLD layout'
                    });
                }
				$("#containerAccessPoint").dialog({position: { my: "center", at: "center", of: window },
				width: '1232'
			    });
				$("#containerAccessPoint").css('height', '94.5%');
				$(".accessPoint").css('height', '97.1%');

                self.reloadAccessPoint(self.accessPointOpened);
            }
            
            
		},

        /**
         * 
         * @param {any} connections 
         * @param {any} hosts 
         * @param {any} dios 
         */
        initializeApVisualizer: function (connections, hosts, dios) {
            // Reduce to unique fusions
            var uniqueFusions = connections.fusionsD3.reduce((accumulator, current) => {
                if (!accumulator.find((item) => item.id === current.id)) {
                    accumulator.push(current);
                }
                return accumulator;
            }, []);

            //adiciona portas dos hosts nas fusões
            for (let host of hosts) {
			    for (let port of host.ports) {
			        let concatFusion = false;

			        // Verifica se o connection_id existe em connectionsLeft
					connections.connectionsLeft.filter(c => c.slots.filter(s => s.connection_id === port.connection_id).forEach(slot =>{
						concatFusion = true;
					}));
			        
			        // Verifica connectionsRight apenas se não encontrou em connectionsLeft
					connections.connectionsRight.filter(c => c.slots.filter(s => s.connection_id === port.connection_id).forEach(slot =>{
						concatFusion = true;
					}));

			        if (concatFusion || port.port_id) {
			            uniqueFusions = uniqueFusions.concat(port);
			        }
			    }
			}

            // If there was another apVisualizer active, destroy it first
            if ($rootScope.apVisualizer) {
                $rootScope.apVisualizer.destroy();
                $rootScope.apVisualizer = null;
            }

            // Start apVisualizer with remove fusions unset
            self.removingFusions = false;

            // Construct access point data object
            let apData = new window.AccessPointData(
                self.accessPointOpened.name,
                self.accessPointOpened.id,
                [...hosts, ...connections.connectionsLeft, ...connections.connectionsRight], // Cable Connections
                connections.connectionsBottom, // Client Connections
                [...connections.connectionsLeft, ...connections.connectionsRight], // Splitters
                uniqueFusions,
                $rootScope.Fusions.codeColor,
				dios
            );
            let apVisualizer = new window.AccessPointVisualizer(
                apData,
                {
                    width: parseInt($("#containerAccessPoint").css('width')) - 40,
                    height: 2200,
                    // border: "1px solid red", 
                    wrapperId: "#cy",
                    debug: false,
                    base_url: $rootScope.base_url
                },
                {
                    "otdr": self.otdr,
                    "removeFusion": Fusions.removeFusion,
                    "deployClient": $rootScope.Clients.deploy,
                    "requestReport": $rootScope.FusionsReport.requestReport,
                    "editConnection": self.editConnection,
					"editHost": self.editHost,
                    "editHostCoords": self.editHostCoords,
                    "editDioCoords": self.editDioCoords,
					"addTray": self.addTray,
					"removeTray": self.removeTray,
					"editDioConnection": self.editDioConnection,
					"connectCableInTray": self.connectCableInTray,
					"removeTubeTray": self.removeTubeTray,
					"dioEditPort": self.dioEditPort,
					"removeDioPortExternalConnection": Dios.removeDioPortExternalConnection,
                    "connectDioPortToHost": Dios.connectDioPortToHost,
                    "connectDioPortToDioPort": Dios.connectDioPortToDioPort,
                    "removeConnection": self.removeConnection,
                    "removeClientConnection": self.removeClientConnection,
					"isDioConnected": self.isDioConnected,
                    "closeCurrentWindow": self.closeCurrentAccessPoint,
                    "accessPointOpened": self.accessPointOpened,
                    "removeHost": self.removeHost,
                    "removeDio": self.removeDio,
                    "dioOpen": self.dioOpen,
                    "dioOpenNewWindow": self.dioOpenNewWindow,
                    "openAccessPointFromReport": self.openAccessPointFromReport,
                    "get_fiber_route": $rootScope.AccessPoints.get_fiber_route,
					"get_fiber_route_complete": $rootScope.AccessPoints.get_fiber_route_complete,
					"openUnifilarVisualModal": self.openUnifilarVisualModal,
					"printUnifilarVisual": self.printUnifilarVisual,
                    "translateText": $rootScope.Users.translateText,
                    "addSlotNote": self.addSlotNote,
                    "editSlotNote": self.editSlotNote,
                    "showNote": self.showNote,
                    "editFusionLoss": $rootScope.Fusions.editFusionLoss,
                    "editPortAlias": self.editPortAlias,
                    "editSplitter": self.editSplitter,
					"editDioName": self.editDioName,
                    "tubeColorCode": self.tubeColorCode,
                    "sharedDatabase": self.sharedDatabase,
                    "LevelsAndModes": LevelsAndModes,
                    "editPortPower": self.editPortPower,
                    "editPortRx": self.editPortRx,
                    "changeConnectionType": $rootScope.Fusions.changeConnectionType,
                    "createFusion": Fusions.createFusion,
                    "setarRotaReload": Fusions.setarRotaReload,
                    "setSlotReloadReport": self.setSlotReloadReport,
                    "updateFusion": Fusions.updateFusion,
                    "updateNoFusion": Fusions.updateNoFusion,
                    "showPowerDiv": Fusions.showPowerDiv,
                    "hidePowerDiv": Fusions.hidePowerDiv
                }
            );

            // Gives global access to the visualizer object in angular,
            // but this would limit to one access point being visualized 
            // at a time.
            $rootScope.apVisualizer = apVisualizer;
        },

		setApVisualizer : function(){

			/**
			 * START APV TEST
			 */
			// Usa a função reduce no array fusions para pegar somente 
			// fusões únicas, de acordo com o id das fusões.

			var connections = self.connections;

			var uniqueFusions = connections.fusionsD3.reduce((accumulator, current) => {
				if (!accumulator.find((item) => item.id === current.id)) {
					accumulator.push(current);
				}
				return accumulator;
				}, []);

			//adiciona portas dos hosts nas fusões
			for (let host of hosts) {
			    for (let port of host.ports) {
			        let concatFusion = false;
					
			        // Verifica se o connection_id existe em connectionsLeft
					self.connections.connectionsLeft.filter(c => c.slots.filter(s => s.connection_id === port.connection_id).forEach(slot =>{
						concatFusion = true;
					}));
			        
			        // Verifica connectionsRight apenas se não encontrou em connectionsLeft
					self.connections.connectionsRight.filter(c => c.slots.filter(s => s.connection_id === port.connection_id).forEach(slot =>{
						concatFusion = true;
					}));

			        if (concatFusion || port.port_id) {
			            uniqueFusions = uniqueFusions.concat(port);
			        }
			    }
			}

            // If there was another apVisualizer active, destroy it first
            if ($rootScope.apVisualizer){
                $rootScope.apVisualizer.destroy();
                $rootScope.apVisualizer = null;
            }

            // Start apVisualizer with remove fusions unset
            self.removingFusions = false;

			// Construct access point data object
			let apData = new window.AccessPointData(
				self.accessPointOpened.name,
				self.accessPointOpened.id,
				[...hosts,...connections.connectionsLeft,...connections.connectionsRight], // Cable Connections
				connections.connectionsBottom, // Client Connections
				[...connections.connectionsLeft,...connections.connectionsRight], // Splitters
				uniqueFusions,
				$rootScope.Fusions.codeColor,
				self.dios
			);
			let apVisualizer = new window.AccessPointVisualizer(
				apData, 
				{
					width: parseInt($("#containerAccessPoint").css('width')) - 40, 
					height: 2200, 
					// border: "1px solid red", 
					wrapperId: "#cy",
					debug: false,
                    base_url: $rootScope.base_url
				},
				{
					"otdr": self.otdr,
					"removeFusion": Fusions.removeFusion,
					"deployClient": $rootScope.Clients.deploy,
					"requestReport": $rootScope.FusionsReport.requestReport,
					"editConnection": self.editConnection,
					"editHostCoords": self.editHostCoords,
					"editDioCoords": self.editDioCoords,
					"addTray": self.addTray,
					"removeTray": self.removeTray,
					"editDioConnection": self.editDioConnection,
					"connectCableInTray": self.connectCableInTray,
					"removeTubeTray": self.removeTubeTray,
					"dioEditPort": self.dioEditPort,
					"removeDioPortExternalConnection": Dios.removeDioPortExternalConnection,
                    "connectDioPortToHost": Dios.connectDioPortToHost,
					"connectDioPortToDioPort": Dios.connectDioPortToDioPort,
					"removeConnection": self.removeConnection,
					"removeClientConnection": self.removeClientConnection,
					"isDioConnected": self.isDioConnected,
                    "closeCurrentWindow": self.closeCurrentAccessPoint,
					"accessPointOpened": self.accessPointOpened,
					"removeHost": self.removeHost,
					"removeDio": self.removeDio,
					"dioOpen": self.dioOpen,
					"openAccessPointFromReport": self.openAccessPointFromReport,
					"get_fiber_route": $rootScope.AccessPoints.get_fiber_route,
					"get_fiber_route_complete": $rootScope.AccessPoints.get_fiber_route_complete,
					"openUnifilarVisualModal": self.openUnifilarVisualModal,
					"printUnifilarVisual": self.printUnifilarVisual,
					"translateText": $rootScope.Users.translateText,
					"addSlotNote": self.addSlotNote,
					"editSlotNote": self.editSlotNote,
					"showNote": self.showNote,
					"editFusionLoss": $rootScope.Fusions.editFusionLoss,
					"editPortAlias": self.editPortAlias,
					"editSplitter": self.editSplitter,
					"editDioName": self.editDioName,
					"sharedDatabase": self.sharedDatabase,
					"LevelsAndModes": LevelsAndModes,
					"editPortPower": self.editPortPower,
					"editPortRx": self.editPortRx,
					"changeConnectionType": $rootScope.Fusions.changeConnectionType,
					"editHost": self.editHost,
					"tubeColorCode": self.tubeColorCode,
					"createFusion": Fusions.createFusion,
					"showPowerDiv": Fusions.showPowerDiv,
					"hidePowerDiv": Fusions.hidePowerDiv
				}
			);
			// Gives global access to the visualizer object in angular,
			// but this would limit to one access point being visualized 
			// at a time.
			
			$rootScope.apVisualizer = apVisualizer;

			/**
			 * END APV TEST
			 */

		},

		createHosts : function(accessPoint){
			var d = $q.defer();
			//montar cabos , spliters e equipamentos

			if(accessPoint.sharedDatabase && accessPoint.hosts){
				hosts = [];	
				
				self.connectionsOrHostsLeft = 1;
				accessPoint.hosts.filter(h=>h).forEach(host=>{
					hosts.push(host);
				});
				
				d.resolve(hosts);

				return d.promise;
			}
			
			$.ajax({
				url: $rootScope.base_url+'/hosts/list_all',
				type: 'POST',
				data: {id:accessPoint.id},
				success:function(response){					
					hosts = [];	
					angular.forEach(response, function(el,val){

						
						if(el.access_point_id == accessPoint.id){
							self.connectionsOrHostsLeft = 1;
							angular.forEach(el.ports, function(port,index){
								port.id_html = 'port_'+el.id+'_'+index;
								port.col = 'L';
							});

							el.x_newLayout = el.x;
							el.y_newLayout = el.y;
							
							hosts.push(el);	
						}						
					});
					d.resolve(hosts);
				},
				error:function(response){
					d.reject(response);
				}
			});			
			return d.promise;
		},

        createDios: function (accessPoint) {
            var d = $q.defer();
            //montar cabos , spliters e equipamentos

            if (accessPoint.dios) {
                dios = [];

                self.connectionsOrHostsLeft = 1;
                accessPoint.dios.filter(h => h).forEach(dio => {
                    dios.push(dio);
                });

                d.resolve(dios);

                return d.promise;
            }

            $.ajax({
                url: $rootScope.base_url + '/dios/get',
                type: 'POST',
                data: { access_point_id: accessPoint.id },
                success: function (response) {
                    dios = [];
                    if (response) {
                        response.forEach(dio => {
                            angular.forEach(dio.dio_ports, function (port, index) {
                                port.id_html = 'dio_port_' + dio.id + '_' + index;
                                port.col = 'L';
                                port.dio_id = dio.id;
                                port.connected = port.connection_id && port.fiber ? true : false;
                            });
    
                            //decodificar json
                            angular.forEach(dio.dio_trays, function (tray, index) {
                                // Verifica se tray.tray_content_json é uma string não vazia
                                if (typeof tray.tray_content_json === 'string' && tray.tray_content_json.trim() !== '') {
                                    // Faz o parse apenas se não estiver vazio
                                    tray.tray_content_json = JSON.parse(tray.tray_content_json);
                                } else {
                                    // Define como um array vazio se for vazio ou não for uma string
                                    tray.tray_content_json = [];
                                }
                            });
    
    
                            dio.x_newLayout = dio.x;
                            dio.y_newLayout = dio.y;
    
                            dios.push(dio); 
                        });
                    }
                    d.resolve(dios);
                },
                error: function (response) {
                    d.reject(response);
                }
            });
            return d.promise;
        },



		createCableConnection:function(el){
			conn = [];
			conn.cable = [];						
			conn.slots = [];
			cont = 1;	

			conn.cable = el.cable;	
			conn.cable_id = el.cable_id;
			conn.direction = el.direction;
			conn.draw_seq = el.draw_seq;
			conn.id = el.id;
			conn.side = el.side;
			conn.x_newLayout = el.x;
			conn.y_newLayout = el.y;
			conn.connected_dio_id = el.connected_dio_id;
			if(el.next_ap != ""){
			    conn.next_ap = JSON.parse(el.next_ap);
			}else{
				conn.next_ap = "";
			}
			
			//seção temporaria para separar as fusions das connections até que ela seja feita no controller do Cake...talvez nao seja temporaria
			if(el.fusions_in){
				angular.forEach(el.fusions_in, function(el,index){
					connections['fusions'][el.id] = el;
					connections['fusionsD3'].push(el);
				});
			}
			if(el.fusions_out){
				angular.forEach(el.fusions_out, function(el,index){
					connections['fusions'][el.id] = el;
					connections['fusionsD3'].push(el);
				})	;
			}

			// var slotY = conn.y;

			if(el.side == "left" || el.side == "L" || el.side == "top"){

				self.connectionsOrHostsLeft = 1;

				//esquerda
				if(el.cable.cable_type.category == 2){
					slot = [];
					slot.col = 'L';
					slot.id = el.id+'_'+cont;
					slot.fiber = cont;
					slot.connection_id = el.id;
					slot.code_color = el.cable.cable_type.code_color;
					slot.color_fiber = cont % (el.cable.cable_type.number_fibers/el.cable.cable_type.tubes);
					//Add the right note to the slot.
					angular.forEach(el.connection_slot_notes, function(note, index_note){
						if (note.slot_number == slot.fiber){
							slot.note = note.note;
							slot.note_id = note.id;
						}
					});
				    if((slot.color_fiber == 0)&&(slot.fiber>1)){
					     slot.color_fiber = el.cable.cable_type.tubes;  
					}else{
					     if(slot.color_fiber == 0){
					         slot.color_fiber = 1;
					      }
					}
					conn.slots.push(slot);
				}else{
					tube_color = 1;
					while(cont <= el.cable.cable_type.number_fibers){
						slot = [];
						slot.col = 'L';
						slot.id = el.id+'_'+cont;
						slot.fiber = cont;
						slot.connection_id = el.id;
						slot.code_color = el.cable.cable_type.code_color;
						slot.color_fiber = cont % (el.cable.cable_type.number_fibers/el.cable.cable_type.tubes);
						//Add the right note to the slot.
						angular.forEach(el.connection_slot_notes, function(note, index_note){
							if (note.slot_number == slot.fiber){
								slot.note = note.note;
								slot.note_id = note.id;
							}
						});
						//Tube color part

						//Se fiberhome 16 ou 32 altera cores do tubo
						if(el.cable.cable_type.code_color === 3){
							if(tube_color === 1){
								slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][3];
							} else if (tube_color === 2){
								slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][2];
							} else if (tube_color === 3){
								slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][1];
							} else if (tube_color === 4){
								slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][5];
							}
						}else if(el.cable.cable_type.code_color === 4){
							if(tube_color === 1){
								slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][3];
							} else if (tube_color === 2){
								slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][1];
							}
						}else if(el.cable.cable_type.code_color === 7){

                            if(el.cable.cable_type.tubes === 4){

                            	if(tube_color === 1){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][1];
                            	}else if(tube_color === 2){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][2];
                            	}else if(tube_color === 3){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][3];
                            	}else if(tube_color === 4){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][4];
                            	}

                            }else if(el.cable.cable_type.tubes === 6){

                            	if(tube_color <= 2){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][1];
                            	}else if(tube_color >= 3 && tube_color <= 4){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][2];
                            	}else if(tube_color >= 5 && tube_color <= 6){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][3];
                            	}
                            
                            }else if(el.cable.cable_type.tubes === 8){

                            	if(tube_color <= 2){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][1];
                            	}else if(tube_color >= 3 && tube_color <= 4){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][2];
                            	}else if(tube_color >= 5 && tube_color <= 6){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][3];
                            	}else if(tube_color >= 7 && tube_color <= 8){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][4];
                            	}

                            }else if(el.cable.cable_type.tubes === 12){

                            	if(tube_color <= 3){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][1];
                            	}else if(tube_color >= 4 && tube_color <= 6){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][2];
                            	}else if(tube_color >= 7 && tube_color <= 9){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][3];
                            	}else if(tube_color >= 10 && tube_color <= 12){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][4];
                            	}

                            }else if(el.cable.cable_type.tubes === 16){

                            	if(tube_color === 1 || (tube_color >= 5 && tube_color <= 7)){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][1];
                            	}else if(tube_color === 2 || (tube_color >= 8 && tube_color <= 10)){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][2];
                            	}else if(tube_color === 3 || (tube_color >= 11 && tube_color <= 13)){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][3];
                            	}else if(tube_color === 4 || (tube_color >= 14 && tube_color <= 16)){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][4];
                            	}

                            }

						}else {
							slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][tube_color];
						}
						if (slot.color_fiber == 0){
							tube_color = tube_color + 1;
						}

                        //recomeça codigo de cores dos tubos
                        if(tube_color > el.cable.cable_type.tubes){
							tube_color = 1;
						}

						//End of tube color part
					    if((slot.color_fiber == 0)&&(slot.fiber>1)){
						     slot.color_fiber = (el.cable.cable_type.number_fibers/el.cable.cable_type.tubes);
						}else{
						     if(slot.color_fiber == 0){
						         slot.color_fiber = 1;
						      }
						}
						conn.slots.push(slot);
						cont++;
					}
				}
				connections['connectionsLeft'].push(conn);

			}else if(el.side == "right" || el.side == "R"){
					//direita
				if(el.cable.cable_type.category == 2){
					slot = [];
					slot.col = 'R';
					slot.id = el.id+'_'+cont;
					slot.fiber = cont;
					slot.connection_id = el.id;
					slot.code_color = el.cable.cable_type.code_color;
					slot.color_fiber = cont % (el.cable.cable_type.number_fibers/el.cable.cable_type.tubes);
					//Add the right note to the slot.
					angular.forEach(el.connection_slot_notes, function(note, index_note){
						if (note.slot_number == slot.fiber){
							slot.note = note.note;
							slot.note_id = note.id;
						}
					});
				    if((slot.color_fiber == 0)&&(slot.fiber>1)){
					     slot.color_fiber = el.cable.cable_type.tubes;  
					}else{
					     if(slot.color_fiber == 0){
					         slot.color_fiber = 1;
					     }
					}								
					cont++;
					conn.slots.push(slot);
				}else{
						tube_color = 1;
						while(cont <= el.cable.cable_type.number_fibers){
						slot = [];
						slot.col = 'R';
						slot.id = el.id+'_'+cont;
						slot.fiber = cont;
						slot.connection_id = el.id;
						slot.code_color = el.cable.cable_type.code_color;
						slot.color_fiber = cont % (el.cable.cable_type.number_fibers/el.cable.cable_type.tubes);
						//Add the right note to the slot.
						angular.forEach(el.connection_slot_notes, function(note, index_note){
							if (note.slot_number == slot.fiber){
								slot.note = note.note;
								slot.note_id = note.id;
							}
						});
						//Tube color part
						
						//Se fiberhome 16 ou 32 altera cores do tubo
						if(el.cable.cable_type.code_color === 3){
							if(tube_color === 1){
								slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][3];
							} else if (tube_color === 2){
								slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][2];
							} else if (tube_color === 3){
								slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][1];
							} else if (tube_color === 4){
								slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][5];
							}
						}else if(el.cable.cable_type.code_color === 4){
							if(tube_color === 1){
								slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][3];
							} else if (tube_color === 2){
								slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][1];
							}
						}else if(el.cable.cable_type.code_color === 7){

                            if(el.cable.cable_type.tubes === 4){

                            	if(tube_color === 1){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][1];
                            	}else if(tube_color === 2){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][2];
                            	}else if(tube_color === 3){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][3];
                            	}else if(tube_color === 4){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][4];
                            	}

                            }else if(el.cable.cable_type.tubes === 6){

                            	if(tube_color <= 2){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][1];
                            	}else if(tube_color >= 3 && tube_color <= 4){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][2];
                            	}else if(tube_color >= 5 && tube_color <= 6){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][3];
                            	}
                            
                            }else if(el.cable.cable_type.tubes === 8){

                            	if(tube_color <= 2){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][1];
                            	}else if(tube_color >= 3 && tube_color <= 4){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][2];
                            	}else if(tube_color >= 5 && tube_color <= 6){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][3];
                            	}else if(tube_color >= 7 && tube_color <= 8){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][4];
                            	}

                            }else if(el.cable.cable_type.tubes === 12){

                            	if(tube_color <= 3){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][1];
                            	}else if(tube_color >= 4 && tube_color <= 6){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][2];
                            	}else if(tube_color >= 7 && tube_color <= 9){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][3];
                            	}else if(tube_color >= 10 && tube_color <= 12){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][4];
                            	}

                            }else if(el.cable.cable_type.tubes === 16){

                            	if(tube_color === 1 || (tube_color >= 5 && tube_color <= 7)){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][1];
                            	}else if(tube_color === 2 || (tube_color >= 8 && tube_color <= 10)){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][2];
                            	}else if(tube_color === 3 || (tube_color >= 11 && tube_color <= 13)){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][3];
                            	}else if(tube_color === 4 || (tube_color >= 14 && tube_color <= 16)){
                            		slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][4];
                            	}

                            }

                        }else if(el.cable.cable_type.code_color === 8){ // CHINES 1

                        	if(tube_color === 1){
								slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][1];
							} else if (tube_color === 2){
								slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][2];
							}
                            
						}else {
							slot.color_tube = self.tubeColorCode[el.cable.cable_type.code_color][tube_color];
						}
						
						if (slot.color_fiber == 0){
							tube_color = tube_color + 1;
						}

                        //recomeça codigo de cores dos tubos
						if(tube_color > el.cable.cable_type.tubes){
							tube_color = 1;
						}
						
						//End of tube color part
					    if((slot.color_fiber == 0)&&(slot.fiber>1)){
						     slot.color_fiber = (el.cable.cable_type.number_fibers/el.cable.cable_type.tubes);
						}else{
						     if(slot.color_fiber == 0){
						         slot.color_fiber = 1;
						     }
						}
						cont++;
						conn.slots.push(slot);
					}
				}
				connections['connectionsRight'].push(conn);
			}
		},
		
		createClientConnection : function(el){			
			client_conn = [];
			//Get base data
			client_conn.client = el.client;
			if(el.client.sharedDatabase){
				client_conn.sharedDatabase = el.client.sharedDatabase;
			}
			//Define the color of the box
			if (!client_conn.fusion_connected){
				client_conn.color = "blue";
				client_conn.stroke = "black";
			} else {
				client_conn.color = "black";
				client_conn.stroke = "blue";
			}
			client_conn.id = el.id;
			client_conn.x = 70 + (self.client_connections_drawn * 25);

			//guardar posições vindas do bd pra serem usadas no d3
			client_conn.x_newLayout = el.x ? el.x : client_conn.x;
			client_conn.y_newLayout = el.y ? el.y : 1000;
			//usado pra desenhar o cliente na caixa no novo_layout
            var clientData = $rootScope.Clients.clients.find(c=>c.id === el.client.id);
            if (clientData && !clientData.apartment_id){
			    client_conn.icon_newLayout = clientData.marker.icon.url;
            }else{
				client_conn.icon_newLayout = $rootScope.MarkerImage.createdPngs["client#c0c0c0black32"];
			}
            
			//TODO get real Y value
			//client_conn.y = 870;
			client_conn.fiber = 1;
			client_conn.connection_id = el.id;
			//Define col as "B", for the fusion drawing
			client_conn.side = "B";
			client_conn.col = "B";
			//Define if client is already connected (has a fiber on it)
			client_conn.connected = self.getClientConnectedStatus(el);
			//Count connections drawn for spacing
			self.client_connections_drawn += 1;
			self.client_connections.push(client_conn);
			connections['connectionsBottom'].push(client_conn);
		},
		
		getClientConnectedStatus : function(client_conn){
			if ((client_conn.fusions_in.length > 0) || (client_conn.fusions_out.length > 0)){
				return 1;
			} else {
				return 0;
			}
		},
		
		createSplitterConnection : function(el){
			conn = [];
			conn.cable = [];						
			conn.slots = [];
			cont = 1;	

			conn.splitter = el.splitter;	
			conn.splitter_id = el.splitter_id;
			conn.direction = el.direction;
			conn.draw_seq = el.draw_seq;
			conn.id = el.id;
			conn.side = el.side;
			cont = 0;

			conn.x_newLayout = el.x;
			conn.y_newLayout = el.y;

			// Processar fusions
			this.processFusions(el);

			// Determinar lado e criar slots
			var side = (el.side == "L" || el.side == "left") ? "left" : "right";
			
			if (side === "left") {
				self.connectionsOrHostsLeft = 1;
			}

			// Criar slots para o splitter
			this.createSplitterSlots(el, conn, side);

			// Adicionar conexão ao lado apropriado
			connections[side === "left" ? 'connectionsLeft' : 'connectionsRight'].push(conn);
		},

		// Função auxiliar para processar fusions
		processFusions: function(el) {
			if(el.fusions_in){
				angular.forEach(el.fusions_in, function(fusion, index){
					connections['fusions'][fusion.id] = fusion;
					connections['fusionsD3'].push(fusion);
				});
			}
			if(el.fusions_out){
				angular.forEach(el.fusions_out, function(fusion, index){
					connections['fusions'][fusion.id] = fusion;
					connections['fusionsD3'].push(fusion);
				});
			}
		},

		// Função auxiliar para criar slots de splitter
		createSplitterSlots: function(el, conn, side) {
			var col = side === "left" ? "L" : "R";
			var cont = 0;

			// Para splitters tipo 4, criar slots especiais primeiro
			if (el.splitter.type == 4) {
				var specialSlots = [
					{fiber: 0, input_type: 'IN1'},
					{fiber: -1, input_type: 'IN2'}
				];
				
				angular.forEach(specialSlots, function(specialSlot){
					var slot = this.createSlot(el, specialSlot.fiber, specialSlot.input_type, col);
					conn.slots.push(slot);
				}.bind(this));
				
				cont = 1; // Começar slots de saída do 1
			}
			
			// Criar slots de saída
			while(cont <= el.splitter.ports_number){
				var slot = this.createSlot(el, cont, null, col);
				conn.slots.push(slot);
				cont++;
			}
		},

		// Função auxiliar para criar um slot individual
		createSlot: function(el, fiber, inputType, col) {
			var slot = {
				col: col,
				id: el.id + '_' + fiber,
				fiber: fiber,
				connection_id: el.id,
				code_color: 0,
				color_fiber: 0,
				db_tomodat: this.setDbSlot(el.id, fiber)
			};
			
			if (inputType) {
				slot.input_type = inputType;
			}
			
			// Adicionar notas se existirem
			angular.forEach(el.connection_slot_notes, function(note, index_note){
				if (note.slot_number == slot.fiber){
					slot.note = note.note;
					slot.note_id = note.id;
				}
			});
			
			return slot;
		},

		// Função auxiliar para determinar db_tomodat
		setDbSlot: function(connectionId, fiber) {
			var db_tomodat = null;
			connections.fusions.filter(fus => fus && ((fus.access_point_connection_id_in === connectionId
				&& fus.fiber_in === fiber && (fus.access_point_connection_out && (f = fus.access_point_connection_out.db_tomodat)))|| (fus.access_point_connection_id_out === connectionId
				&& fus.fiber_out === fiber && (fus.access_point_connection_in && (f = fus.access_point_connection_in.db_tomodat))))).forEach(fusao =>{
					db_tomodat = f;
			});
			return db_tomodat;
		},
		
		addSlotNote : function(slot){
			if(LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_VIEW, LevelsAndModes.levels.NIVEL_VIEWEXPORT]) ||
				LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_TECNICO]) || 
                LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR])){
				var options = {
						autoOpen: false,
						modal: true,
						title: $rootScope.Users.translateText("Adicionar nota"),
						width: 300,
						height: 'auto',
						resizable:false,
						close:function(){
							$rootScope.form = [];
							$rootScope.form.error = [];
						}
				};
				model = [];  
				$rootScope.form = [];
				$rootScope.form.error = [];
				$rootScope.form.current_slot = slot;
				$rootScope.dialogService.open('slotNoteAdd','slotNoteAdd', model, options);
			}
		},

		editSlotNote : function(slot){
			if(LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_TECNICO]) || 
                LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR])){
				var options = {
						autoOpen: false,
						modal: true,
						title:"Editar nota",
						width: 300,
						height: 'auto',
						resizable:false,
						close:function(){
							$rootScope.form = [];
							$rootScope.form.error = [];
						}
				};
				model = [];  
				$rootScope.form = [];
				$rootScope.form.error = [];
				$rootScope.form.current_slot = slot;
				$rootScope.form.slot_note_text = slot.note;
				$rootScope.form.edit_slot_note = true;
				$rootScope.dialogService.open('slotNoteAdd','slotNoteAdd', model, options);
			}
		},
		
		addSlotNoteConfirm : function(){
			self.isLoading = true;
			dataSend = {};
			dataSend.access_point_connection_id = $rootScope.form.current_slot.connection_id;
			dataSend.slot_number = $rootScope.form.current_slot.fiber;
			dataSend.note = $rootScope.form.slot_note_text;
			if ($rootScope.form.edit_slot_note){
				link = $rootScope.base_url+'/connection_slot_notes/edit';
				dataSend.id = $rootScope.form.current_slot.note_id;
			} else if(LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_VIEW, LevelsAndModes.levels.NIVEL_VIEWEXPORT])){
				//allow view user to add notes in slots
				link = $rootScope.base_url+'/connection_slot_notes/add_note_view_user';
			}else{
				link = $rootScope.base_url+'/connection_slot_notes/add';
			}
			$.ajax({
				url: link,
				type: 'POST',
				data: dataSend,
				complete:function(response){
					$rootScope.set_errors_modal(response.responseJSON,'slotNoteAdd');
					if(response.responseJSON.status == 1){
						var slotUpdated = [];
	                	//--------------------------------------------------------------------------
	                	// Check all connections on the left and on the right.
	                	// if the connection matches with the one where the note was added, 
						// add the note to the slot in order to update the view
						angular.forEach($rootScope.Connections.connections['connectionsLeft'], function(connection, index_conn){
							if (connection.id == dataSend.access_point_connection_id){
	                			angular.forEach(connection.slots, function(slot, index_slot){
	                				if (slot.fiber == dataSend.slot_number){
	                					$rootScope.Connections.connections['connectionsLeft'][index_conn].slots[index_slot].note = dataSend.note;
	                					$rootScope.Connections.connections['connectionsLeft'][index_conn].slots[index_slot].note_id = response.responseJSON.id;
										slotUpdated = $rootScope.Connections.connections['connectionsLeft'][index_conn].slots[index_slot];
									}
	                			})
	                		} 
						});
						angular.forEach($rootScope.Connections.connections['connectionsRight'], function(connection, index_conn){
							if (connection.id == dataSend.access_point_connection_id){
	                			angular.forEach(connection.slots, function(slot, index_slot){
	                				if (slot.fiber == dataSend.slot_number){
	                					$rootScope.Connections.connections['connectionsRight'][index_conn].slots[index_slot].note = dataSend.note;
	                					$rootScope.Connections.connections['connectionsRight'][index_conn].slots[index_slot].note_id = response.responseJSON.id;
										slotUpdated = $rootScope.Connections.connections['connectionsRight'][index_conn].slots[index_slot];
									}
	                			})
	                		} 
						});
						//--------------------------------------------------------------------------
					}
					self.isLoading = false;
					$rootScope.$apply();
				}
			});
		},

		deleteSlotNote : function(){
			self.isLoading = true;
			connection_id = $rootScope.form.current_slot.connection_id;
			slot_number = $rootScope.form.current_slot.fiber;
			slot_note_id = $rootScope.form.current_slot.note_id;
			$.ajax({
				url: $rootScope.base_url+'/connection_slot_notes/delete',
				type: 'POST',
				data: {id:slot_note_id},
				complete:function(response){
					$rootScope.set_errors_modal(response.responseJSON,'slotNoteAdd');
					if(response.responseJSON.status == 1){
						var slotUpdated = [];
	                	//--------------------------------------------------------------------------
	                	// Check all connections on the left and on the right.
	                	// if the connection matches with the one where the note was added, 
						// add the note to the slot in order to update the view
						angular.forEach($rootScope.Connections.connections['connectionsLeft'], function(connection, index_conn){
							if (connection.id == connection_id){
	                			angular.forEach(connection.slots, function(slot, index_slot){
	                				if (slot.fiber == slot_number){
	                					$rootScope.Connections.connections['connectionsLeft'][index_conn].slots[index_slot].note = null;
	                					$rootScope.Connections.connections['connectionsLeft'][index_conn].slots[index_slot].note_id = null;
										slotUpdated = $rootScope.Connections.connections['connectionsLeft'][index_conn].slots[index_slot];
									}
	                			})
	                		} 
						});
						angular.forEach($rootScope.Connections.connections['connectionsRight'], function(connection, index_conn){
							if (connection.id == connection_id){
	                			angular.forEach(connection.slots, function(slot, index_slot){
	                				if (slot.fiber == slot_number){
	                					$rootScope.Connections.connections['connectionsRight'][index_conn].slots[index_slot].note = null;
	                					$rootScope.Connections.connections['connectionsRight'][index_conn].slots[index_slot].note_id = null;
										slotUpdated = $rootScope.Connections.connections['connectionsRight'][index_conn].slots[index_slot];
									}
	                			})
	                		} 
						});
						//--------------------------------------------------------------------------
						//atualiza desenho da nota no d3 se o novo visual esteja on
						if(!self.originalApShow){
							$rootScope.apVisualizer.updateSlotNote(slotUpdated);
						}
					}
					
					$rootScope.$apply();
				}
			});
		},
		
		showNote : function(current_slot, value){
			angular.forEach($rootScope.Connections.connections['connectionsLeft'], function(connection, index_conn){
				if (connection.id == current_slot.connection_id){
        			angular.forEach(connection.slots, function(slot, index_slot){
        				if (slot.fiber == current_slot.fiber){
        					$rootScope.Connections.connections['connectionsLeft'][index_conn].slots[index_slot].show_note = value;
        				}
        			})
        		} 
			});
			angular.forEach($rootScope.Connections.connections['connectionsRight'], function(connection, index_conn){
				if (connection.id == current_slot.connection_id){
        			angular.forEach(connection.slots, function(slot, index_slot){
        				if (slot.fiber == current_slot.fiber){
        					$rootScope.Connections.connections['connectionsRight'][index_conn].slots[index_slot].show_note = value;
        				}
        			})
        		} 
			});
		},
		
		editPortAlias : function(port_info){
			if(LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_TECNICO]) || 
                LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR])){
				var options = {
						autoOpen: false,
						modal: true,
						title:"Editar alias",
						width: 300,
						height: 'auto',
						resizable:false,
						close:function(){
							$rootScope.form = [];
							$rootScope.form.error = [];
						}
				};
				model = [];  
				$rootScope.form = [];
				$rootScope.form.error = [];
				$rootScope.form.port_info_id = port_info.id;
				$rootScope.form.alias = port_info.alias;
				$rootScope.dialogService.open('portAliasAddModal','portAliasAddModal', model, options);
			}
		},
		
		editPortAliasConfirm : function(){
			data = {};
			data.id = $rootScope.form.port_info_id;
			data.alias = $rootScope.form.alias;
			$.ajax({
				url: $rootScope.base_url+'/hosts/edit_port_information',
				type: 'POST',
				data: data,
				complete:function(response){
					$rootScope.set_errors_modal(response.responseJSON,'portAliasAddModal');
					if(response.responseJSON.status == 1){
						angular.forEach(self.hosts, function(host, host_index){
							angular.forEach(host.ports, function(port, port_index){
								if (port.port_information.id == data.id){
									self.hosts[host_index].ports[port_index].port_information.alias = data.alias;
									if(!self.originalApShow){
										$rootScope.apVisualizer.updateSlotAlias(self.hosts[host_index].ports[port_index]);
									}
								}
							});
						});
						$rootScope.$apply();
					}	
				}
			});
		},
		
		showPortAlias : function(port, show){
			if (!port.port_information.alias){
				return;
			}
			if (show){
				angular.forEach(self.hosts, function(host, host_index){
					angular.forEach(host.ports, function(current_port, port_index){
						if (current_port.id == port.id){
							self.hosts[host_index].ports[port_index].show_alias = 1;
						}
					});
				});
			} else {
				angular.forEach(self.hosts, function(host, host_index){
					angular.forEach(self.hosts[host_index].ports, function(current_port, port_index){
						if (current_port.id == port.id){
								self.hosts[host_index].ports[port_index].show_alias = 0;
						}
					});
				});
			}
		},
		
		/**
		 * Creates a special type of connection in the given access_point, related to the given client
		 * 
		 * */
		connectClientToAp : function(client, access_point){

			dataSend = {};
			dataSend.access_point_id = access_point.id;
			dataSend.client_id = client.id;

			if(access_point.sharedDatabase){
				dataSend.access_point_id = access_point.real_id;
				dataSend.sharedDatabase = access_point.sharedDatabase;
				dataSend.db_tomodat = $rootScope.db_tomodat_local;
			}
			
			$.ajax({
				url: $rootScope.base_url+'/access_points/connect_client',
				type: 'POST',
				data: dataSend,
				success:function(data){
					if (data.status == 1){
						
					}
				},
				complete:function(response){
					
				}
			});
		},
		
		/**
		 * This method is triggered when a (not connected) client is clicked, and then an access point is clicked.
		 * A client connection will be created inside the access point, then a DROP cable is created,
		 * and the client is set to connected, informing the id of the access_point it's connected to.
		 */
		connectClient : function(client, access_point, in_building){
			//If the AP isn't a EMENDA or a caixa de ATENDIMENTO, don't do anything
			if (access_point.category < 3){
				return;
			}
			//Create connection in the AP
			self.connectClientToAp(client, access_point);
			//Create cable
			$rootScope.Cables.addDropCable(client, access_point, in_building);
			//Mark client as connected
			$rootScope.Clients.setConnected(client.id, access_point.id);

			if (!in_building){
				//Finish unsetting the flag, and stopping the blinking
				$rootScope.Clients.connecting_client = false;
				$rootScope.Clients.blink(client, false);
			}
		},
		
		showClientName : function(client_conn, view_status){
			angular.forEach(self.client_connections, function(conn, index_conn){
				if (conn.id == client_conn.id){
					self.client_connections[index_conn].show_name = view_status;
					if (client_conn.client.name.length < 10){
						self.client_connections[index_conn].text_x = client_conn.x;
					} else {
						self.client_connections[index_conn].text_x = client_conn.x - (client_conn.client.name.length * 2);
					}
				}
			});
		},
		
		removeClientConnection : function(client_conn){
			if (client_conn.connected == 1){
				$rootScope.messageAlert = $rootScope.Users.translateText('Remova a fusao da conexao de cliente antes de deletar a conexao.');
				var options = {
                        autoOpen: false,
                        modal: true,
                        title: $rootScope.Users.translateText('Atenção'),
                        width: 'auto',
                        height:'auto',
                        resizable:true,
                        dialogClass: "noclose", 
                };
                model = [];  
                $rootScope.dialogService.open('alertModal','alertModal', model, options).then();
				return;
			}
			if(LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_TECNICO]) || 
                LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR])){
				var i, current_client;
				if ($rootScope.Buildings.buildingOpen){
					for (i = 0; i < $rootScope.Buildings.buildingOpen.floors.length; i++){
						for (j = 0; j < $rootScope.Buildings.buildingOpen.floors[i].apartments.length; j++){
							if ($rootScope.Buildings.buildingOpen.floors[i].apartments[j].client && ($rootScope.Buildings.buildingOpen.floors[i].apartments[j].client.id == client_conn.client.id)){
								current_client = $rootScope.Buildings.buildingOpen.floors[i].apartments[j].client;
								break;
							}
						}
					}
					for (i = 0; i < $rootScope.Buildings.buildingOpen.cables.length; i++){
						if ($rootScope.Buildings.cableConnectedTo($rootScope.Buildings.buildingOpen.cables[i], 2, current_client.id)){
							$rootScope.delete_client_conn_id = client_conn.id;
							$rootScope.delete_cable_id = $rootScope.Buildings.buildingOpen.cables[i].id;
							$rootScope.client_id = current_client.id;
							break;
						}
					}
				} else {
					for (i = 0; i < $rootScope.Clients.clients.length; i++){
						if ($rootScope.Clients.clients[i].id == client_conn.client.id){
							current_client = $rootScope.Clients.clients[i];
							break;
						}
					}
					$rootScope.delete_client_conn_id = client_conn.id;
					$rootScope.delete_cable_id = current_client.drop_cable_id;
					$rootScope.client_id = client_conn.client.id;
				}
			
				//Open Modal
				var options = {
						autoOpen: false,
						modal: true,
						title: $rootScope.Users.translateText("Remover conexao com cliente"),
						width: 300,
						height: 'auto',
						resizable:false,
						close:function(){
						}
				};
				model = [];
				$rootScope.dialogService.open('removeClientConn','removeClientConn', model, options);
			}
			
		},
		
		removeClientConnectionConfirm : function(client_connection){
			var client_conn_id, delete_cable_id, client_id;
			var async = true;
			var remove_drawing = true;
			//If the connection was sent as a parameter, get the relevant information
			if (client_connection){
				client_conn_id = client_connection.id;
				client_id = client_connection.client_id;
				var current_client = null;
				for (var i = 0; i < $rootScope.Clients.clients.length; i++){
					if ($rootScope.Clients.clients[i].id == client_id){
						current_client = $rootScope.Clients.clients[i];
						break;
					}
				}
				if (current_client){
					delete_cable_id = current_client.drop_cable_id;
				}
				async = false;
				remove_drawing = false;
			} else {
				//If no parameter was sent, it is a follow-up method after the modal confirmation
				client_conn_id = $rootScope.delete_client_conn_id;
				delete_cable_id = $rootScope.delete_cable_id;
				client_id = $rootScope.client_id;
			}
			$.ajax({
				url: $rootScope.base_url+'/access_points/delete_client_connection',
				type: 'POST',
				data: {id: client_conn_id, sharedDatabase: self.sharedDatabase},
				async: async,
				success:function(data){
					if (data.status == 1){
						var i;
						if (remove_drawing){
							for(i = 0; i < self.client_connections.length; i++){
								if (self.client_connections[i].id == client_conn_id){
									self.client_connections.splice(i,1);
									break;
								}
							}
						}
						
						//remove client D3 SVG
						if($rootScope.apVisualizer){
							$rootScope.apVisualizer.removeClientSVG(client_id);
						}
					}
				},
				complete:function(response){
					
				}
			});
			if (delete_cable_id || $rootScope.Buildings.buildingOpen){
				$rootScope.Cables.deleteDropCable(delete_cable_id);
			}
			$rootScope.Clients.setNotConnected(client_id);
			//Only try to close modal if the deletion is tied to a modal
			if (remove_drawing){
				$rootScope.dialogService.close('removeClientConn');
			}
			
		},

		/**
		 * openUnifilarVisualModal
		 * Opens unifilar visual view in the same access point modal
		 * Uses the existing visualizer to show unifilar mode
		 */
		openUnifilarVisualModal : function(slot){
			
			if (!slot || !slot.report_data || !slot.report_data.access_points || !slot.report_data.access_points.length){
				console.warn("Slot sem dados de relatório para visualização unifilar");
				return;
			}

			// Garantir que a modal do ponto de acesso está aberta
			if (!self.accessPointOpen || !$rootScope.apVisualizer) {
				console.warn("Modal do ponto de acesso não está aberta");
				return;
			}

			// Alinhado ao PDF: mesmo endpoint e parâmetros que accessPointService.get_fiber_route
			var fusion = $rootScope.Fusions.findSlotFusionSync(slot);
			var fusionId = fusion ? fusion.id : null;

			// Buscar dados da rota de fibra (igual ao PDF: último AP da rota do slot)
			var fiber = slot.fiber;
			var connId = slot.connection_id;
			var aps = slot.report_data.access_points;
			var initialAp = aps[aps.length - 1]; // Último AP, igual ao PDF
			var apId = initialAp.id;

			var url = $rootScope.base_url + '/access_points/get_fiber_route';
			console.log('[UNIFILAR_INIT] Requisição (igual ao PDF): ap_id=' + apId + ' (último AP: ' + (initialAp.name || 'N/A') + '), conn_id=' + connId + ', fiber=' + fiber + ', url=' + url);

			// Mostrar spinner (seguindo padrão das outras funções)
			self.apVisualizerLoadingFiberReports = true;
			if (!$rootScope.$$phase) {
				$rootScope.$apply();
			}

			// Mesmo endpoint e parâmetros do PDF: get_fiber_route com fiber, ap_id, conn_id (sem fusion_id)
			$.ajax({
				url: url,
				type: 'POST',
				data: {
					fiber: fiber,
					ap_id: apId,
					conn_id: connId
				},
				success: function(response) {
					// Passar todas as rotas para o mapa (sem filtro), igual ao PDF
					console.log('[UNIFILAR_BACK] Rotas recebidas: ' + (response ? response.length : 0) + ' (passando todas ao mapa, sem filtro)');
					if (response && response.length > 0 && response[0]) {
						console.log('[UNIFILAR_BACK] Primeira rota: access_points=' + (response[0].access_points ? response[0].access_points.length : 0) + ', splitter_ref_id=' + (response[0].splitter_ref_id || 'N/A'));
						// Inserir na primeira rota todos os APs do slot que vêm antes do início da rota do backend,
						// para a fibra ir: originário -> próximo AP -> ... -> splitter (e não direto pro splitter)
						if (aps && aps.length > 0 && response[0].access_points && response[0].access_points.length > 0) {
							var firstApInRoute = response[0].access_points[0];
							var idxInSlot = -1;
							for (var i = 0; i < aps.length; i++) {
								if (aps[i].id === firstApInRoute.id) {
									idxInSlot = i;
									break;
								}
							}
							if (idxInSlot > 0) {
								// Inserir aps[0], aps[1], ..., aps[idxInSlot-1] no início da rota (ordem: originário -> próximo AP -> ...)
								for (var j = idxInSlot - 1; j >= 0; j--) {
									response[0].access_points.unshift(aps[j]);
								}
								console.log('[UNIFILAR_BACK] Inseridos ' + idxInSlot + ' AP(s) na primeira rota (originário + intermediários):', aps.slice(0, idxInSlot).map(function(a) { return a.name || a.id; }).join(' -> '));
							} else if (idxInSlot < 0 && firstApInRoute.id !== aps[0].id) {
								// Primeiro AP da rota não está no slot; mesmo assim inserir o originário
								response[0].access_points.unshift(aps[0]);
								console.log('[UNIFILAR_BACK] Inserido AP originário na primeira rota:', aps[0].name || aps[0].id);
							}
						}
					}

					if ($rootScope.apVisualizer && typeof $rootScope.apVisualizer.enterUnifilarMode === 'function') {
						$rootScope.apVisualizer.enterUnifilarMode(response);
					} else {
						console.warn("Método enterUnifilarMode não está disponível no visualizador");
					}

					// Ocultar spinner
					self.apVisualizerLoadingFiberReports = false;
					if (!$rootScope.$$phase) {
						$rootScope.$apply();
					}
				},
				error: function(err) {
					console.error("Erro ao buscar rota de fibra para visualização unifilar:", err);
					// Ocultar spinner em caso de erro
					self.apVisualizerLoadingFiberReports = false;
					if (!$rootScope.$$phase) {
						$rootScope.$apply();
					}
				}
			});
		},

		/**
		 * Filtra as rotas retornadas para mostrar apenas as relacionadas à fusão específica
		 */
		filterRoutesByFusion : function(routes, fusionId, slot, fusion){
			// Toggle local de debug para evitar poluir o console em produção
			var FILTER_ROUTES_DEBUG = false;
			var toNum = function(v){
				if (v === null || v === undefined || v === "") return null;
				var n = (typeof v === "number") ? v : Number(v);
				return isFinite(n) ? n : null;
			};

			if (!routes || !Array.isArray(routes) || routes.length === 0) {
				console.warn('[FILTER_ROUTES] Nenhuma rota para filtrar');
				return routes;
			}

			console.log('[FILTER_ROUTES] Entrada: routes.length=', routes.length, ', fusionId=', fusionId);

			if (FILTER_ROUTES_DEBUG) console.log('[FILTER_ROUTES] Total de rotas recebidas: ' + routes.length + ', fusionId: ' + fusionId);

			// Se não tem fusionId ou fusion, não filtrar - retornar todas as rotas
			if (!fusionId || !fusion) {
				if (FILTER_ROUTES_DEBUG) console.log('[FILTER_ROUTES] Sem fusionId ou fusion, retornando todas as rotas');
				console.log('[FILTER_ROUTES] Saída: sem filtro, retornando todas as rotas=', routes.length);
				return routes;
			}

			if (FILTER_ROUTES_DEBUG) console.log('[FILTER_ROUTES] Fusão encontrada: ID=' + fusion.id + ', connIn=' + fusion.access_point_connection_id_in + ', fiberIn=' + fusion.fiber_in + ', connOut=' + fusion.access_point_connection_id_out + ', fiberOut=' + fusion.fiber_out);
			if (FILTER_ROUTES_DEBUG) console.log('[FILTER_ROUTES] Slot: connId=' + slot.connection_id + ', fiber=' + slot.fiber);

			var slotConnId = toNum(slot.connection_id);
			var slotFiber = toNum(slot.fiber);
			var fusionConnIn = toNum(fusion.access_point_connection_id_in);
			var fusionConnOut = toNum(fusion.access_point_connection_id_out);
			var fusionFiberIn = toNum(fusion.fiber_in);
			var fusionFiberOut = toNum(fusion.fiber_out);

			// Identificar em qual lado da fusão o slot está (in ou out)
			var isSlotOnInSide = slotConnId !== null && slotFiber !== null && slotConnId === fusionConnIn && slotFiber === fusionFiberIn;
			var isSlotOnOutSide = slotConnId !== null && slotFiber !== null && slotConnId === fusionConnOut && slotFiber === fusionFiberOut;
			
			// Determinar qual conexão/fibra usar para filtrar (o lado oposto da fusão)
			var targetConnId = null;
			var targetFiber = null;
			
			if (isSlotOnInSide) {
				// Slot está no lado IN, filtrar rotas que começam no lado OUT
				targetConnId = fusionConnOut;
				targetFiber = fusionFiberOut;
				if (FILTER_ROUTES_DEBUG) console.log('[FILTER_ROUTES] Slot está no lado IN da fusão, filtrando rotas do lado OUT (connId=' + targetConnId + ', fiber=' + targetFiber + ')');
			} else if (isSlotOnOutSide) {
				// Slot está no lado OUT, filtrar rotas que começam no lado IN
				targetConnId = fusionConnIn;
				targetFiber = fusionFiberIn;
				if (FILTER_ROUTES_DEBUG) console.log('[FILTER_ROUTES] Slot está no lado OUT da fusão, filtrando rotas do lado IN (connId=' + targetConnId + ', fiber=' + targetFiber + ')');
			} else {
				// Slot não corresponde exatamente à fusão, usar conexão/fibra do slot
				targetConnId = slotConnId;
				targetFiber = slotFiber;
				if (FILTER_ROUTES_DEBUG) console.log('[FILTER_ROUTES] Slot não corresponde exatamente à fusão, usando slot (connId=' + targetConnId + ', fiber=' + targetFiber + ')');
			}

			// Coletar IDs de splitters encontrados nas rotas que correspondem à fusão
			// Esses splitters podem ter saídas que também precisam ser mostradas
			var relevantSplitterIds = {};
			
			// Primeiro, identificar rotas que correspondem à fusão e coletar seus splitters
			routes.forEach(function(route){
				var routeConnId = null;
				var routeFiber = toNum(route.fiber_number || route.fiber_ref);
				
				if (route.connection_id) {
					routeConnId = toNum(route.connection_id);
				} else if (route.access_points && route.access_points.length > 0) {
					var firstAp = route.access_points[0];
					if (firstAp.access_point_connections && Array.isArray(firstAp.access_point_connections)) {
						var matchingConn = firstAp.access_point_connections.find(function(conn){
							return toNum(conn.id) === targetConnId || toNum(conn.id) === slotConnId;
						});
						if (matchingConn) {
							routeConnId = toNum(matchingConn.id);
						} else if (firstAp.access_point_connections.length > 0) {
							routeConnId = toNum(firstAp.access_point_connections[0].id);
						}
					}
				}
				
				// Se a rota corresponde à fusão (lado IN ou OUT), coletar seus splitters
				var matchesTarget = routeFiber !== null && targetFiber !== null && routeConnId !== null && targetConnId !== null && routeFiber === targetFiber && routeConnId === targetConnId;
				var matchesSlot = routeFiber !== null && slotFiber !== null && routeConnId !== null && slotConnId !== null && routeFiber === slotFiber && routeConnId === slotConnId;
				
				if (matchesTarget || matchesSlot) {
					// Coletar splitters desta rota
					if (route.splitters && Array.isArray(route.splitters)) {
						route.splitters.forEach(function(splitter){
							if (splitter.splitter_id) {
								relevantSplitterIds[splitter.splitter_id] = true;
							}
						});
					}
					// Coletar splitters dos access_points
					if (route.access_points && Array.isArray(route.access_points)) {
						route.access_points.forEach(function(ap){
							if (ap.splitters && Array.isArray(ap.splitters)) {
								ap.splitters.forEach(function(splitter){
									if (splitter.splitter_id) {
										relevantSplitterIds[splitter.splitter_id] = true;
									}
								});
							}
						});
					}
				}
			});

			var splitterIdsList = Object.keys(relevantSplitterIds);
			if (FILTER_ROUTES_DEBUG) console.log('[FILTER_ROUTES] Splitters relevantes encontrados: [' + splitterIdsList.join(', ') + ']');

			// Filtrar rotas que começam na conexão/fibra alvo ou contêm a fusão específica
			var filteredRoutes = routes.filter(function(route, index){
				// Obter conexão e fibra da rota
				var routeConnId = null;
				var routeFiber = toNum(route.fiber_number || route.fiber_ref);
				
				// Tentar obter connection_id da rota de várias formas
				if (route.connection_id) {
					routeConnId = toNum(route.connection_id);
				} else if (route.access_points && route.access_points.length > 0) {
					var firstAp = route.access_points[0];
					// Verificar se o primeiro access_point tem a conexão alvo
					if (firstAp.access_point_connections && Array.isArray(firstAp.access_point_connections)) {
						var matchingConn = firstAp.access_point_connections.find(function(conn){
							return toNum(conn.id) === targetConnId || toNum(conn.id) === slotConnId;
						});
						if (matchingConn) {
							routeConnId = toNum(matchingConn.id);
						} else if (firstAp.access_point_connections.length > 0) {
							routeConnId = toNum(firstAp.access_point_connections[0].id);
						}
					}
				}

				// Verificar se a rota corresponde à conexão/fibra alvo (lado oposto da fusão)
				var matches = routeFiber !== null && targetFiber !== null && routeConnId !== null && targetConnId !== null && routeFiber === targetFiber && routeConnId === targetConnId;
				
				// Verificar se a rota começa no lado OUT da fusão (onde o slot está)
				if (!matches) {
					matches = routeFiber !== null && slotFiber !== null && routeConnId !== null && slotConnId !== null && routeFiber === slotFiber && routeConnId === slotConnId;
					if (matches) {
						if (FILTER_ROUTES_DEBUG) console.log('[FILTER_ROUTES] ✅ Rota ' + index + ' começa no lado OUT da fusão (slot)');
					}
				}
				
				// Verificar se a rota é saída de um splitter relevante (encontrado nas rotas da fusão)
				if (!matches && route.splitter_ref_id) {
					if (relevantSplitterIds[route.splitter_ref_id]) {
						matches = true;
						if (FILTER_ROUTES_DEBUG) console.log('[FILTER_ROUTES] ✅ Rota ' + index + ' é saída do splitter relevante ' + route.splitter_ref_id + ' (saida=' + (route.saida || 'N/A') + ')');
					}
				}
				
				// Se não encontrou correspondência direta, verificar se a rota contém a fusão específica
				// E se começa na conexão/fibra do slot (lado onde o usuário clicou)
				if (!matches && route.fusions && Array.isArray(route.fusions)) {
					var hasFusion = route.fusions.some(function(routeFusion){
						return routeFusion.id === fusionId;
					});
					if (hasFusion) {
						// Verificar se a rota começa na conexão/fibra do slot (lado onde o usuário clicou)
						var startsAtSlot = routeFiber !== null && slotFiber !== null && routeConnId !== null && slotConnId !== null && routeFiber === slotFiber && routeConnId === slotConnId;
						if (startsAtSlot) {
							matches = true;
							if (FILTER_ROUTES_DEBUG) console.log('[FILTER_ROUTES] ✅ Rota ' + index + ' contém a fusão ' + fusionId + ' e começa no slot');
						} else {
							if (FILTER_ROUTES_DEBUG) console.log('[FILTER_ROUTES] ⚠️ Rota ' + index + ' contém a fusão ' + fusionId + ' mas não começa no slot (fiber=' + routeFiber + ', connId=' + routeConnId + ' vs slot: fiber=' + slot.fiber + ', connId=' + slot.connection_id + ')');
						}
					}
				}
				
				// Verificar também se algum access_point da rota contém a fusão
				// Mas só incluir se a rota começa na conexão/fibra do slot
				if (!matches && route.access_points && Array.isArray(route.access_points)) {
					var hasFusionInAp = route.access_points.some(function(ap){
						return ap.fusions && Array.isArray(ap.fusions) && 
							ap.fusions.some(function(routeFusion){
								return routeFusion.id === fusionId;
							});
					});
					if (hasFusionInAp) {
						// Verificar se a rota começa na conexão/fibra do slot
						var startsAtSlot = routeFiber !== null && slotFiber !== null && routeConnId !== null && slotConnId !== null && routeFiber === slotFiber && routeConnId === slotConnId;
						if (startsAtSlot) {
							matches = true;
							if (FILTER_ROUTES_DEBUG) console.log('[FILTER_ROUTES] ✅ Rota ' + index + ' contém a fusão ' + fusionId + ' em um access_point e começa no slot');
						} else {
							if (FILTER_ROUTES_DEBUG) console.log('[FILTER_ROUTES] ⚠️ Rota ' + index + ' contém a fusão ' + fusionId + ' em access_point mas não começa no slot');
						}
					}
				}
				
				if (matches) {
					if (FILTER_ROUTES_DEBUG) console.log('[FILTER_ROUTES] ✅ Incluindo rota ' + index + ': fiber=' + routeFiber + ', connId=' + routeConnId + ', splitter_ref_id=' + (route.splitter_ref_id || 'N/A') + ', saida=' + (route.saida || 'N/A'));
				} else {
					if (FILTER_ROUTES_DEBUG) console.log('[FILTER_ROUTES] ❌ Excluindo rota ' + index + ': fiber=' + routeFiber + ', connId=' + routeConnId + ' (alvo: fiber=' + targetFiber + ', connId=' + targetConnId + ')');
				}

				return matches;
			});

			if (FILTER_ROUTES_DEBUG) console.log('[FILTER_ROUTES] Rotas filtradas: ' + filteredRoutes.length + ' de ' + routes.length);

			// Se não encontrou rotas filtradas, retornar todas as rotas
			// (pode ser que a estrutura das rotas seja diferente do esperado)
			if (filteredRoutes.length === 0) {
				console.warn('[FILTER_ROUTES] Nenhuma rota filtrada encontrada, retornando todas as rotas');
				return routes;
			}

			console.log('[FILTER_ROUTES] Saída: rotas após filtro=', filteredRoutes.length);
			return filteredRoutes;
		},

		/**
		 * printUnifilarVisual
		 * Imprime a visualização unifilar
		 * Segue o padrão do printImageMap do regionReportsService
		 */
		printUnifilarVisual : function(){
			
			// Encontrar o elemento do mapa dentro do foreignObject
			var mapContainer = document.querySelector('#unifilar-map-container');
			if (!mapContainer) {
				console.warn('Container do mapa não encontrado');
				return;
			}

			// Criar doc PDF (seguindo padrão do printImageMap)
			var doc = new jsPDF('l', 'px', 'a1', true);

			// Capturar o elemento do mapa diretamente (seguindo padrão do printImageMap)
			html2canvas(mapContainer, {
				useCORS: true
			}).then(function(canvas) {
				var imgData = canvas.toDataURL('image/jpg');

				// Adicionar imagem ao PDF (seguindo padrão do printImageMap)
				// Usar dimensões do canvas para manter proporção
				doc.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height, '', 'FAST');

				var apName = self.accessPointOpened ? self.accessPointOpened.name : 'Unifilar';
				doc.save(apName + '_Unifilar.pdf');
			}).catch(function(error) {
				console.error('Erro ao gerar PDF:', error);
			});
		}
	}

																														  //acqua
	// self.tubeColorCode[1] = ["null","blue","orange","green","brown","gray","white","red","black","yellow","violet","pink","#00ffff"];
	// self.tubeColorCode[2] = ["null","green","yellow","white","white","white","white","white","white","white","white","white","white"];
	// self.tubeColorCode[3] = ["null","blue","green","red","yellow","white","white","white","white","white","white","white","white"];
	// self.tubeColorCode[4] = ["null","blue","green","red","yellow","orange","brown","gray","violet","white","white","white","white"];
	// self.tubeColorCode[5] = ["null","green","red","blue","yellow","gray","violet","brown","orange"];
	// self.tubeColorCode[6] = ["null","green","yellow","white","blue","red","violet","green","yellow","white","blue","red","violet"];
	// self.tubeColorCode[7] = ["null","white","red","blue","green"];
	// self.tubeColorCode[8] = ["null","blue","orange","green","brown","gray","white","red","black","yellow","violet","pink","#00ffff"];
    // self.tubeColorCode[9] = ["null","white","red","blue","green"];
	// self.tubeColorCode[10] = ["null","white","white","red","red","blue","blue"];
	// self.tubeColorCode[11] = ["null","white","white","red","red","blue","blue","green","green"];
	// self.tubeColorCode[12] = ["null","green","red","blue","white","gray","violet","brown","orange"];
	// self.tubeColorCode[13] = ["null","red","green","blue","yellow","gray","white","orange","brown","#00ffff","violet","black","pink"];

	return self;

})



