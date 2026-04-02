app.service("Dios", function ($rootScope) {
    var self = {

        // Loads dio from API
        getDio: async function (id) {
            dio = null;
            await $.ajax({
                url: $rootScope.base_url + "/dios/get_by_id",
                type: "POST",
                data: { id: id },
                success: function (response) {
                    dio = response;
                    if (dio) {
                        angular.forEach(dio.dio_ports, function (port, index) {
                            port.id_html = "dio_port_" + response.id + "_" + index;
                            port.col = "L";
                            port.dio_id = response.id;
                            port.dioConnected = port.connection_id && port.fiber ? true : false;
                        });

                        //decodificar json
                        angular.forEach(dio.dio_trays, function (tray) {
                            // Verifica se tray.tray_content_json é uma string não vazia
                            if (typeof tray.tray_content_json === "string" && tray.tray_content_json.trim() !== "") {
                                // Faz o parse apenas se não estiver vazio
                                tray.tray_content_json = JSON.parse(tray.tray_content_json);
                            } else {
                                // Define como um array vazio se for vazio ou não for uma string
                                tray.tray_content_json = [];
                            }
                        });
                        dio.x_newLayout = dio.x;
                        dio.y_newLayout = dio.y;
                    }
                },
                error: function (response) {
                    console.warn("error:", response);
                }
            });
            return dio;
        },

        getAvailableCableConnections: async function (dio_id) {
            cableConnections = null;
            await $.ajax({
                url: $rootScope.base_url + "/dios/get_available_cable_connections",
                type: "POST",
                data: { id: id },
                success: function (response) {
                    cableConnections = response;
                },
                error: function (response) {
                    console.warn("error:", response);
                }
            });
            return cableConnections;
        },

        getSlotReportData: async function (fiber_number, ap_id, conn_id,sharedDatabase) {
            let reportData = null;
            await $.ajax({
                url: $rootScope.base_url + "/access_points/fiber_report",
                type: "POST",
                data: {fiber_number:fiber_number, access_point_id:ap_id, connection_id:conn_id,sharedDatabase:sharedDatabase},
                success: function (response) {
                    reportData = response;
                },
                error: function (response) {
                    console.warn("error:", response);
                }
            });
            return reportData;
        },

        editDioConnection: async function (cable, access_point_id, dio_id) {
            var dioData = {};

            data = {};
            data.cable_id = cable.id;
            data.access_point_id = access_point_id;
            data.connected_dio_id = dio_id;
            await $.ajax({
                url: $rootScope.base_url + '/dios/editDioConnection',
                type: 'POST',
                data: data,
                complete: function (response) {
                    dioData = response.responseJSON.data;
                    dioData.response_status = response.responseJSON.status;
                }
            });
            return dioData;
        },

        /**
         * 
         * @param {*} connectionData 
         */
        connectDioPortToHost: async function(dioPortId, hostId, hostPort){
            let success = false;
            let url = $rootScope.base_url+'/dios/connect_dio_port_to_host';
            await $.ajax({
				url: url,
				type: 'POST',
				data: {id: dioPortId, host_id: hostId, host_port: hostPort},
				success:function(response){
					if (response.status){
                        success = true;
                    }
				},
			});
            return success;
        },

        /**
         * Connect DIO Port to another DIO Port
         * @param {int} dioPortId 
         * @param {int} targetDioPortId 
         */
        connectDioPortToDioPort: async function(dioPortId, targetDioPortId){
            let success = false;
            let url = $rootScope.base_url+'/dios/connect_dio_port_to_dio_port';
            await $.ajax({
				url: url,
				type: 'POST',
				data: {id: dioPortId, connected_dio_port_id: targetDioPortId},
				success:function(response){
					if (response.status){
                        success = true;
                    }
				},
			});
            return success;
        },

        /**
         * Remove DIO Port external connection
         * @param {int} dioPortId 
         */
        removeDioPortExternalConnection: async function(dioPortId){
            let success = false;
            let url = $rootScope.base_url+'/dios/dio_port_remove_external_connection';
            await $.ajax({
				url: url,
				type: 'POST',
				data: {id: dioPortId},
				success:function(response){
					if (response.status){
                        success = true;
                    }
				},
				complete:function(response){
				}
			});
            return success;
        },

        dioTrayConnect: async function(tray, connection_new){
            var dioData = {};
            var data = {};
            data.id = tray.id;
            data.dio_id = tray.dio_id;
            data.tray_content_json = JSON.stringify(tray.tray_content_json);
            await $.ajax({
                url: $rootScope.base_url + '/dios/dio_tray_connect',
                type: 'POST',
                data: data,
                complete: function (response) {
                    dioData = response.responseJSON.data;
                    dioData.response_status = response.responseJSON.status;
                }
            });
            return dioData;
        },

        colorCodesList : async function(){
            colorCodes = {
                AccessPoints: {},
                Connections: {},
                Fusions: {}
            };
			self.isLoading = true;
			link = $rootScope.base_url+'/color_codes/list_all';
			await $.ajax({
				url: link,
				type: 'POST',
				success:function(data){ 
					colorCodes.AccessPoints.colorCode = [];
					colorCodes.Connections.tubeColorCode = [];
					colorCodes.Fusions.codeColor = [];
					colorCodes.Fusions.codeColor[0] = ["grey"];
					for(code of data){
						colorCodes.AccessPoints.colorCode[code.id] = [...[[]], ...JSON.parse(code.aps_color_code_json)];
						colorCodes.Connections.tubeColorCode[code.id] = [...["null"], ...JSON.parse(code.connections_color_code_json)];
						colorCodes.Fusions.codeColor[code.id] = [...["null"], ...JSON.parse(code.fusions_color_code_json)];
					}
				}				
			}); 
			return colorCodes;
		},

        addSplitter : async function(newSplitterData){
			dataSend = {};
			dataSend.direction = '0';
			dataSend.access_point_id = newSplitterData.access_point_id,
			dataSend.connected_dio_id = newSplitterData.connected_dio_id;
			dataSend.splitter = {};
			dataSend.splitter.name = newSplitterData.name;
			dataSend.splitter.type = newSplitterData.type;
			dataSend.splitter.ports_number = newSplitterData.ports_number;

			if (dataSend.splitter.type == 0){
				//Para splitter desbalanceado, deve mandar porcentagens tambem
				dataSend.splitter.out_one = newSplitterData.out_one.toFixed(2);
				dataSend.splitter.out_two = newSplitterData.out_two.toFixed(2);
			}
			if (self.editing_splitter){
				link = $rootScope.base_url+'/access_points/edit_splitter';
				dataSend.id = newSplitterData.id;
				dataSend.side = newSplitterData.side;				
			} else {
				link = $rootScope.base_url+'/access_points/add_splitter';
				dataSend.side = 'left';
			}
			var splitterResponse = {};
            await $.ajax({
				url: link,
				type: 'POST',
				data: dataSend,
				complete:function(response){
                    splitterResponse = response.responseJSON;				
				}
			});
            return splitterResponse;
		},

        addTray: async function (dio_id) {
            var dioData = {};

            data = {};
            data.dio_id = dio_id;
            data.func = 'add';
            await $.ajax({
                url: $rootScope.base_url + '/dios/add_tray',
                type: 'POST',
                data: data,
                complete: function (response) {
                    dioData = response.responseJSON.data;
                    dioData.response_status = response.responseJSON.status;
                }
            });

            return dioData;
        },

		editTray: async function(tray){
            var dioData = {};
            var data = {};
            data = tray;
			
            await $.ajax({
                url: $rootScope.base_url + '/dios/edit_tray',
                type: 'POST',
                data: data,
                complete: function (response) {
                    dioData = response.responseJSON.data;
                    dioData.response_status = response.responseJSON.status;
                }
            });
            return dioData;
        },

		dioEditPort : async function(dioConn){

			dataSend = {};

			if(dioConn.source.port_id){
				
				dataSend.id = dioConn.source.port_id;

				dataSend.connection_id = dioConn.target.connection_id;
	            dataSend.fiber = dioConn.target.fiber;
				
			}else if(dioConn.target.port_id){
				
				dataSend.id = dioConn.target.port_id;

				dataSend.connection_id = dioConn.source.connection_id;
	            dataSend.fiber = dioConn.source.fiber;
				
			}
			
			// dataSend.host_id = dioConn.host_id;
			// dataSend.host_port = dioConn.host_port;
			
            await $.ajax({
                url: $rootScope.base_url+'/dios/edit_port',
                type: 'POST',
                data: dataSend,
                complete: function (response) {
                    dioData = response.responseJSON.data;
                    dioData.response_status = response.responseJSON.status;
                }
            });

            return dioData;
        },
        
        dioEditSlot : async function(slotClickData){

			dataSend = {};

            dataSend.access_point_connection_id_in = slotClickData.source.connection_id;
            dataSend.access_point_connection_id_out = slotClickData.target.connection_id;
            dataSend.fiber_in = slotClickData.source.fiber;
            dataSend.fiber_out = slotClickData.target.fiber; 
            dataSend.connection_type =  0;
            dataSend.draw_type =  0 ;
            dataSend.loss = 0;

            dataSend.dio_id = slotClickData.dio_id;

            await $.ajax({
                url: $rootScope.base_url+'/dios/create_fusion',
                type: 'POST',
                data: dataSend,
                complete: function (response) {
                    dioData = response.responseJSON.data;
                    dioData.response_status = response.responseJSON.status;
                }
            });
            return dioData;
        },
        
        dioRemoveFusion : async function(slotClickData){

			dataSend = {};

            dataSend.connection_id = slotClickData.connection_id;
			dataSend.fiber = slotClickData.fiber;
            dataSend.dio_id = slotClickData.dio_id;

            await $.ajax({
                url: $rootScope.base_url+'/dios/delete_fusion',
                type: 'POST',
                data: dataSend,
                complete: function (response) {
                    dioData = response.responseJSON.data;
                    dioData.response_status = response.responseJSON.status;
                }
            });
            return dioData;
        },

        updateDioPortLayout: async function (dio_id, port_layout) {
            let data = {};
            data.id = dio_id;
            data.port_layout = port_layout;
            await $.ajax({
                url: $rootScope.base_url + '/dios/edit_layout',
                type: 'POST',
                data: data,
                complete: function (response) {
                    if(!response.responseJSON || !response.responseJSON.data) {
                        console.warn("Error editing layout:", response);
                        return;
                    }
                    dioData = response.responseJSON.data;
                    dioData.response_status = response.responseJSON.status;
                }
            });
            return dioData;
        },

        addPortNote: async function (dio_port_id, note) {
            var dioData = {};
            var data = {};
            data.dio_port_id = dio_port_id;
            data.note = note;
            
            return new Promise(function(resolve, reject) {
                $.ajax({
                    url: $rootScope.base_url + '/dios/add_port_note',
                    type: 'POST',
                    data: data,
                    dataType: 'json',
                    success: function (response) {
                        if(response){
                            if(response.data){
                                dioData = response.data;
                            }
                            dioData.response_status = response.status || 0;
                            if(response.errors){
                                dioData.errors = response.errors;
                            }
                            resolve(dioData);
                        } else {
                            dioData.response_status = 0;
                            dioData.errors = ['Erro ao processar resposta do servidor'];
                            resolve(dioData);
                        }
                    },
                    error: function (xhr, status, error) {
                        console.error('AJAX Error:', xhr, status, error);
                        dioData.response_status = 0;
                        dioData.errors = ['Erro ao salvar nota: ' + (error || status)];
                        if(xhr.responseJSON){
                            if(xhr.responseJSON.errors){
                                dioData.errors = xhr.responseJSON.errors;
                            }
                            dioData.response_status = xhr.responseJSON.status || 0;
                        }
                        resolve(dioData);
                    }
                });
            });
        },

        deletePortNote: async function (dio_port_id) {
            var dioData = {};
            var data = {};
            data.dio_port_id = dio_port_id;
            
            return new Promise(function(resolve, reject) {
                $.ajax({
                    url: $rootScope.base_url + '/dios/delete_port_note',
                    type: 'POST',
                    data: data,
                    dataType: 'json',
                    success: function (response) {
                        if(response){
                            if(response.data){
                                dioData = response.data;
                            }
                            dioData.response_status = response.status || 0;
                            if(response.errors){
                                dioData.errors = response.errors;
                            }
                            resolve(dioData);
                        } else {
                            dioData.response_status = 0;
                            dioData.errors = ['Erro ao processar resposta do servidor'];
                            resolve(dioData);
                        }
                    },
                    error: function (xhr, status, error) {
                        console.error('AJAX Error:', xhr, status, error);
                        dioData.response_status = 0;
                        dioData.errors = ['Erro ao deletar nota: ' + (error || status)];
                        if(xhr.responseJSON){
                            if(xhr.responseJSON.errors){
                                dioData.errors = xhr.responseJSON.errors;
                            }
                            dioData.response_status = xhr.responseJSON.status || 0;
                        }
                        resolve(dioData);
                    }
                });
            });
        }

    };
    return self;
});