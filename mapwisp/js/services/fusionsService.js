app.service('Fusions', function($rootScope,Map,Projects,dialogService,$q,Cables,$document,$timeout,LevelsAndModes){
	
	var self = {
		isLoading : false,
		cont : 0,
        cont_slots : 0,
        codeColor : [],	   
        paths : [],
        white_stripe_paths : [],
        black_stripe_paths : [],
        circles : [],
        space : 0 ,
        highlightingFusion: false,
        highlightedFusionData: {
            conn_a: null,
            fiber_a: null,
            conn_b: null,
            fiber_b: null
        },
        source : [],
        target : [],
		client_id : null,
        fusionsInLoading : [],
        apLoadRequests : [],
        fusionPowerD3 : 0,


        resetFusionsAP : function(){
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
            dialogService.open('resetFusions','resetFusions', model, options).then();       
        }, 
        
        resetFusionsAPconfirm : function(id){
        	var ap_id = null;
        	var no_modal = false;
        	var async = true;
        	if (id){
        		ap_id = id;
        		no_modal = true; 
        		async = false;
        	} else {
        		ap_id = $rootScope.Connections.accessPointOpened.id;
        	}

            $rootScope.Connections.isLoading = true;
            
            $.ajax({
                url: $rootScope.base_url+'/access_points/reset_fusions',
                type: 'POST',
                data: {id:ap_id},
                async: async,
                success:function(response){
                	//If the function was called without ties to a modal/dialog,
                	//then nothing has to be done after the ajax call.
                	if (no_modal){
                		return;
                	}
                	
                    if(response.status == 0){
                        $rootScope.alert_message($rootScope.Users.translateText('<h6>Erro ao resetar emendas</h6>'));                            
                    }else{
                        $rootScope.dialogService.cancel('accessPoint');
                        $rootScope.Connections.isLoading = true; 
                        $rootScope.Connections.openAccessPoint($rootScope.Connections.accessPointOpened).then(function(){
                            $rootScope.Connections.isLoading = false; 
                        });
                    }
                }
            });
            $rootScope.dialogService.close('resetFusions');        
        },

        changeConnectionType : function(slot){
            //fazer verificações

            self.findSlotFusion(slot).then(function(fusion){
                var connection_type = ((fusion.connection_type == 1) ? 0 : 1);
                
                conn_in = self.findConnection(fusion.access_point_connection_id_in);
                conn_out = self.findConnection(fusion.access_point_connection_id_out);
                
                dataSend = {};
                dataSend.id = fusion.id;
                dataSend.connection_type = connection_type
                if (connection_type == 1){
                	dataSend.loss = 0.01;
                }
                if(conn_in.cable_id == conn_out.cable_id && fusion.fiber_in == fusion.fiber_out){
                    $.ajax({
                        url: $rootScope.base_url+'/access_points/edit_fusion',
                        type: 'POST',
                        data: dataSend,
                        success:function(response){
                            if(response.status == 0){
                                alert($rootScope.Users.translateText('erro ao remover emenda'));                            
                            }else{
                                $rootScope.dialogService.cancel('accessPoint');
                                $rootScope.Connections.isLoading = true; 
                                $rootScope.Connections.openAccessPoint($rootScope.Connections.accessPointOpened).then(function(){
                                    $rootScope.Connections.isLoading = false; 
                                });
                            }
                        }
                    }); 
                }else{
                    $rootScope.alert_message($rootScope.Users.translateText('Você não pode criar uma passagem aqui'))
                }      
            });
        },       

        editFusionLoss : function(slot){
        	self.findSlotFusion(slot).then(function(fusion){
    			var options = {
    					autoOpen: false,
    					modal: true,
    					title: $rootScope.Users.translateText("Editar perda"),
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
				$rootScope.form.fusion_id = fusion.id;
				$rootScope.form.fusion_loss = fusion.loss;
				$rootScope.form.slot = slot;
				$rootScope.dialogService.open('editFusionLoss','editFusionLoss', model, options);
        	});
        },

        /**
         * Checks if any svg path is part of a highlighted fusion
         * @param {*} path 
         */
        isHighlighted : function(path){
            var highlighted = false;
            if (path.connection_id){
                highlighted = ((path.connection_id === self.highlightedFusionData.conn_a && path.fiber === self.highlightedFusionData.fiber_a) 
                || (path.connection_id === self.highlightedFusionData.conn_b && path.fiber === self.highlightedFusionData.fiber_b));
            } else if (path.host_id){
                highlighted = self.highlightedFusionData.host_id && self.highlightedFusionData.host_id == path.host_id && self.highlightedFusionData.port_id == path.port_id;
            }
            return highlighted;
        },

        /**
         * Gets the opposing connection to which any path is connected
         * @param {*} path 
         */
        findOpposingConnectionOrPort(path){
            for (let i = 0; i < $rootScope.Connections.connections.fusions.length; i++) {
                var fusion = $rootScope.Connections.connections.fusions[i];
                if (!fusion || fusion === null){
                    continue;
                }
                if(fusion.access_point_connection_id_in == path.connection_id && fusion.fiber_in == path.fiber){
                    return {"connection": true, "id": fusion.access_point_connection_id_out};
                }
                if(fusion.access_point_connection_id_out == path.connection_id && fusion.fiber_out == path.fiber){
                    return {"connection": true, "id": fusion.access_point_connection_id_in};
                }
            }
            for (let i = 0; i < $rootScope.Connections.hosts.length; i++) {
                for (let j = 0; j < $rootScope.Connections.hosts[i].ports.length; j++) {
                    let hostPort = $rootScope.Connections.hosts[i].ports[j];
                    if (hostPort.connected && hostPort.connection_id == path.connection_id && hostPort.fiber == path.fiber){
                        return {"connection": false, "host_id": hostPort.host_id, "port_id": hostPort.id};
                    }
                    
                }
            }
            return null;
        },

        /**
         * 
         */
        findOpposingConnFromHost(path){
            if (!path.host_id) {return null;}
            for (let i = 0; i < $rootScope.Connections.hosts.length; i++) {
                for (let j = 0; j < $rootScope.Connections.hosts[i].ports.length; j++) {
                    let hostPort = $rootScope.Connections.hosts[i].ports[j];
                    if (hostPort.connected && hostPort.host_id == path.host_id && hostPort.id == path.port_id){
                        return {"connection": true, "connection_id": hostPort.connection_id, "fiber": hostPort.fiber};
                    }
                    
                }
            }

        },

        /**
         * Creates highlighted fusion data based on clicked path
         * Will save connection id and fiber of current path, and opposing conn and fiber numbers.
         * 
         * This way, both paths of any fiber can be linked to the currently highlighted fusion
         * @param {*} path 
         */
        getHlightedFusionData : function(path){
            var fusionData = {};
            // Clicked on a fusion on a connection side
            if (path.connection_id){
                fusionData.conn_a = path.connection_id;
                fusionData.fiber_a = path.fiber;
                // Other side
                var connOrPort = self.findOpposingConnectionOrPort(path);
                if (connOrPort.connection){
                    fusionData.conn_b = connOrPort.id;
                    fusionData.fiber_b = path.fiber === path.fiber1 ? path.fiber2 : path.fiber1;
                } else {
                    fusionData.host_id = connOrPort.host_id;
                    fusionData.port_id = connOrPort.port_id;
                }
            } else if (path.host_id){
                fusionData.host_id = path.host_id;
                fusionData.port_id = path.port_id;
                // Other Side
                var opposingData = self.findOpposingConnFromHost(path);
                fusionData.conn_b = opposingData.connection_id;
                fusionData.fiber_b = opposingData.fiber;
            } else {
                console.log("What type of connection is this?", path);
            }
            return fusionData;
        },

        /**
         * Called when any fiber in an AP is clicked.
         * 
         * Sets highlighting to true, and generates the highlighted fusiond data.
         * @param {*} path 
         */
        highlightFusion : function(path){
            if (!self.highlightingFusion) {
                // Highlight
                self.highlightedFusionData = self.getHlightedFusionData(path);
                self.highlightingFusion = true;
            } else {
                // Turn highlighting off
                self.highlightingFusion = false;
            }
        },
        
        showPowerDiv : function(path, event){
        	if ((path.direction != 0) && (!path.host_id)){
        		self.show_power_div_called = true;
        		offset =  $('.connectionHost').offset() || $('.connectionLeft').offset();
        		offsetTop = offset.top;
        		offsetLeft = offset.left;
	    		$('.fusion-power-div').css({
	    			left: event.pageX - offsetLeft,
		    		top: event.pageY - offsetTop - 24
	    		});
    		    $rootScope.showingPowerDiv = true;
    		    if (self.connectedToHost(path, event)){
    		    	return;
    		    }
    		    slot = self.findPathActiveSlot(path);
    		    if (slot){
    		    	$rootScope.FusionsReport.requestReport(slot, 0, 0, 0, 0, 0, 1);
        			self.showFusionPowerDiv = true;
    		    }
        	} else if (path.direction != 0){
        		//Buscar dados de potencia
        		var host_port_power = null;
        		var i;
        		for (i = 0; i < $rootScope.Connections.hosts.length; i++){
        			if ($rootScope.Connections.hosts[i].id == path.host_id){
        				var j;
        				for(j = 0; j < $rootScope.Connections.hosts[i].ports.length; j++){
        					if ($rootScope.Connections.hosts[i].ports[j].id == path.port_id){
                				host_port_power = $rootScope.Connections.hosts[i].ports[j].port_information.power;
                				break;
        					}
        				}
        			}
        			if (host_port_power != null){
        				break;
        			}
        		}
        		$rootScope.Fusions.fusion_power_div = host_port_power+'dB';
                if($rootScope.apVisualizer){
                    $rootScope.apVisualizer.fusion_power_div = $rootScope.Fusions.fusion_power_div ;
                }
        		
        		//Setar posicao correta do sinalizador de potencia
        		self.show_power_div_called = true;
        		offset = $('.connectionHost').offset();
        		offsetTop = offset.top;
        		offsetLeft = offset.left;
	    		$('.fusion-power-div').css({
	    			left: event.pageX - offsetLeft,
		    		top: event.pageY - offsetTop - 24
	    		});
        		
        		//Deixar sinalizador visivel
        		self.showFusionPowerDiv = true;
        	}
        },
        
        connectedToHost : function(path, event){
        	//If it's connected to a host, it'll always have inward direction
        	if (path.direction != 1){
        		return false;
        	}
        	var connected_to_host = false;
    		var i;
    		for (i = 0; i < $rootScope.Connections.hosts.length; i++){
				var j;
				for(j = 0; j < $rootScope.Connections.hosts[i].ports.length; j++){
					if ($rootScope.Connections.hosts[i].ports[j].connection_id == path.connection_id && $rootScope.Connections.hosts[i].ports[j].fiber == path.fiber){
						$rootScope.Fusions.fusion_power_div = $rootScope.Connections.hosts[i].ports[j].port_information.power+'dB';
                        if($rootScope.apVisualizer){
						    $rootScope.apVisualizer.fusion_power_div = $rootScope.Fusions.fusion_power_div ;
                        }
		        		//Setar posicao correta do sinalizador de potencia
		        		self.show_power_div_called = true;
		        		offset = $('.connectionHost').offset();
		        		offsetTop = offset.top;
		        		offsetLeft = offset.left;
			    		$('.fusion-power-div').css({
			    			left: event.pageX - offsetLeft,
				    		top: event.pageY - offsetTop - 24
			    		});
		        		self.showFusionPowerDiv = true;
						connected_to_host = true;
        				break;
					}
				}
    			if (connected_to_host){
    				break;
    			}
    		}
    		return connected_to_host;
        },
        
        findPathActiveSlot : function(path){
        	return_slot = null;
        	angular.forEach($rootScope.Connections.connections['connectionsLeft'], function(connection, index_conn){
        		angular.forEach(connection.slots, function(slot, index_slot){
    				if ((slot.connection_id == path.connection_id) && (slot.fiber == path.fiber)){
    					if (slot.report_data.active){
    						return_slot = slot;
    					} else {
        					fusion = self.findSlotFusionSync(slot);
    						new_path = {};
    						if (path.connection_id == fusion.access_point_connection_id_in){
    							new_path.connection_id = fusion.access_point_connection_id_out;
    							new_path.fiber = fusion.fiber_out;
    						} else {
    							new_path.connection_id = fusion.access_point_connection_id_in;
    							new_path.fiber = fusion.fiber_in;
    						}
    						return_slot = self.findPathActiveSlot(new_path);
    					}
    				}
        		});
        	});
        	angular.forEach($rootScope.Connections.connections['connectionsRight'], function(connection, index_conn){
        		angular.forEach(connection.slots, function(slot, index_slot){
    				if ((slot.connection_id == path.connection_id) && (slot.fiber == path.fiber)){
    					if (slot.report_data.active){
    						return_slot = slot;
    					} else {
        					fusion = self.findSlotFusionSync(slot);
    						new_path = {};
    						if (path.connection_id == fusion.access_point_connection_id_in){
    							new_path.connection_id = fusion.access_point_connection_id_out;
    							new_path.fiber = fusion.fiber_out;
    						} else {
    							new_path.connection_id = fusion.access_point_connection_id_in;
    							new_path.fiber = fusion.fiber_in;
    						}
    						return_slot = self.findPathActiveSlot(new_path);
    					}
    				}
        		});
        	});
        	angular.forEach($rootScope.Connections.client_connections, function(connection, index_conn){
        		if (connection.id == path.connection_id){
        			if ((connection.report_data) && (connection.report_data.active)){
						return_slot = slot;
					} else {
    					fusion = self.findSlotFusionSync(connection);
						new_path = {};
						if (path.connection_id == fusion.access_point_connection_id_in){
							new_path.connection_id = fusion.access_point_connection_id_out;
							new_path.fiber = fusion.fiber_out;
						} else {
							new_path.connection_id = fusion.access_point_connection_id_in;
							new_path.fiber = fusion.fiber_in;
						}
						return_slot = self.findPathActiveSlot(new_path);
					}
        		}
        	});
        	return return_slot;
        },
        
        hidePowerDiv : function(){
        	self.show_power_div_called = false;
            $timeout(function(){
            	if (!self.show_power_div_called){
            		self.showFusionPowerDiv = false;
            	}
            },100);
        },
        
        editFusionLossConfirm : function(){
        	self.isLoading = true;
            dataSend = {};
            dataSend.id = $rootScope.form.fusion_id;
            dataSend.loss = $rootScope.form.fusion_loss;
            $.ajax({
                url: $rootScope.base_url+'/access_points/edit_fusion',
                type: 'POST',
                data: dataSend,
                success:function(response){
                	self.setSlotLoss(dataSend.loss, $rootScope.form.slot);
                	$rootScope.set_errors_modal(response,'editFusionLoss');
                    $rootScope.Fusions.setarRotaReload(fusion);
                    $rootScope.Fusions.refreshSplitterOutputs(fusion);           
                	self.isLoading = false;
                    //atualiza desenho da nota no d3
                    if($rootScope.apVisualizer){
                        var slotUpdated = [];
                        slotUpdated = $rootScope.form.slot;
                        slotUpdated.fusion_loss = $rootScope.form.fusion_loss;
                        $rootScope.apVisualizer.updateFusionLoss(slotUpdated);
                    }
                }
            });

        },

        removeFusion : function(fusion) {
            if (!fusion){
                return false;
            }
            console.log("Fusions.removeFusion", fusion);
            let success = false;
            if (fusion.host_id) {
                success = self.removeHostFusion(fusion);
            } else {
                // deletar fusão
                success = self.removeGeneralFusion(fusion);
            }

            return success;
        },

        /**
         * Sends request to remove fusion, and 
         * calls cleanup methods after
         * @param {*} fusion 
         */
        removeGeneralFusion: function(fusion){
            let success = false;
            
            let client_id = null;
            if(fusion.access_point_connection_in && fusion.access_point_connection_in.client_id){
                client_id = fusion.access_point_connection_in.client_id;
            }else if(fusion.access_point_connection_out && fusion.access_point_connection_out.client_id){
                client_id = fusion.access_point_connection_out.client_id;
            }
            
            $.ajax({
                url: $rootScope.base_url+"/access_points/delete_fusion",
                type: "POST",
                data: {
                    id: fusion.id, 
                    client_id: self.client_id, 
                    sharedDatabase: $rootScope.Connections.sharedDatabase
                },
                async: false,
                success:function(response){
                    if(response.status) {
                        success = true;
                        
                        // Mark both slots as disconnected
                        let source = { id: fusion.access_point_connection_id_in + '_' + fusion.fiber_in };
                        let target = { id: fusion.access_point_connection_id_out + '_' + fusion.fiber_out };
                        self.checkSlot(source, 0);
                        self.checkSlot(target, 0);
                        
                        self.setarRotaReload(fusion);
                        self.refreshSplitterOutputs(fusion);

                        if(client_id){
                            $rootScope.Clients.clients.filter(c => c.id === client_id).forEach(client => {
                                client.splitter_id = null;
                                client.splitter_port = null;
                                $rootScope.Nodes.changeNodeIcon(4, client);
                            });
                        }
                        $rootScope.$apply();
                    }
                }
            });
            return success; 
        },

        /**
         * Sends request to edit host port, and 
         * calls cleanup methods after
         * @param {*} fusion 
         */
        removeHostFusion: function(fusion){
            let success = false;

            let data = fusion.port_id ? { port_id: null, id: fusion.id } : { connection_id: 0, id: fusion.id, fiber: 0 };

            // editar porta do host para remover conexão
            $.ajax({
                url: $rootScope.base_url+"/hosts/edit_port",
                type: "POST",
                data: data,
                async: false,
                success:function(response){
                    if(response.status == 1){
                        success = true;
                        
                        // Mark both slots as disconnected
                        let source = { id_html: fusion.id_html };
                        let target = { id: fusion.connection_id + '_' + fusion.fiber };
                        self.checkSlot(source, 0);
                        self.checkSlot(target, 0);
                        
                        self.setarRotaReload(fusion);
                        self.refreshSplitterOutputs(fusion);
                    }
                }
            });
            return success;
        },

        split : function(slot){   
            //com host funcinando
            code_color: 0
            col: "R"
            color_fiber: NaN
            connected: 0
            connection_id: 30
            fiber: 1
            id: "30_1"
            //com host nao funcionando

            code_color: 0
            col: "R"
            color_fiber: 0
            connected: 1
            connection_id: 30
            fiber: 1
            host_port: 0
            id: "30_1"



            self.findSlotFusion(slot).then(function(fusion){
                if(fusion){                    
                    if(fusion.host_id){
                        dataSend = {};
                        dataSend.connection_id = 0;
                        dataSend.fiber = 0; 
                        dataSend.id = fusion.id;

                        $.ajax({
                            url: $rootScope.base_url+'/hosts/edit_port',
                            type: 'POST',
                            data: dataSend,
                            success:function(response){
                                if(response.status == 1){    
                                	//Delete color path
                                    angular.forEach(self.paths, function(el,index){
                                        if(el){
                                            if(fusion.connection_id == el.connection_id && fusion.fiber == el.fiber){
                                                self.paths.splice(index,2);
                                            }                   
                                        }
                                    });
                                    //Delete black path
                                    angular.forEach(self.black_stripe_paths, function(el,index){
                                        if(el){
                                            if(fusion.connection_id == el.connection_id && fusion.fiber == el.fiber){
                                                self.black_stripe_paths.splice(index,2);
                                            }                   
                                        }
                                    });
                                    //Delete white path
                                    angular.forEach(self.white_stripe_paths, function(el,index){
                                        if(el){
                                            if(fusion.connection_id == el.connection_id && fusion.fiber == el.fiber){
                                                self.white_stripe_paths.splice(index,2);
                                            }                   
                                        }
                                    });
                                    //_____________________________________________________________________
                                    //Delete color path
                                    angular.forEach(self.paths, function(el,index){
                                        if(el){
                                            if(fusion.id == el.port_id && fusion.host_id == el.host_id){
                                                self.paths.splice(index,2);
                                            }                   
                                        }
                                    });
                                    //Delete black path
                                    angular.forEach(self.black_stripe_paths, function(el,index){
                                        if(el){
                                            if(fusion.id == el.port_id && fusion.host_id == el.host_id){
                                                self.black_stripe_paths.splice(index,2);
                                            }                   
                                        }
                                    }); 
                                    //Delete white path
                                    angular.forEach(self.white_stripe_paths, function(el,index){
                                        if(el){
                                            if(fusion.id == el.port_id && fusion.host_id == el.host_id){
                                                self.white_stripe_paths.splice(index,2);
                                            }                   
                                        }
                                    });
                                    
                                    // Delete fusion from fusion list in connections
                                    angular.forEach($rootScope.Connections.hosts, function(host,host_index){
                                        angular.forEach(host.ports, function(port,port_index){
                                            if((port.fiber == fusion.fiber && port.connection_id == fusion.connection_id)){
                                            	host.ports.splice(index, 1);
                                            }
                                        });
                                    });


                                    // fiber_in
                                    // connection_in
                                    // fiber_out
                                    // connection_out

                                    source = [];
                                    target = [];
                                    source.id_html = fusion.id_html;                                    
                                    target.id = fusion.connection_id+'_'+fusion.fiber;
                                    self.checkSlot(source,0);
                                    self.checkSlot(target,0);
                                    self.setarRotaReload(fusion);
                                    self.refreshSplitterOutputs(fusion);
                                    $rootScope.$apply();
                                } else {
                                    $rootScope.alert_message($rootScope.Users.translateText('<h6>Erro ao editar porta</h6>'));
                                }
                            }
                        });
                    }else{
                        //encontrar source e target 
                        // self.checkSlot(source,2);
						
						//se for cliente pega client_id pra setar null splitter_id e splitter_port

						self.client_id = null;
						
						if(fusion.access_point_connection_in && fusion.access_point_connection_in.client_id){
							
							self.client_id = fusion.access_point_connection_in.client_id;
							
						}else if(fusion.access_point_connection_out && fusion.access_point_connection_out.client_id){
							
							self.client_id = fusion.access_point_connection_out.client_id;
						}

                        $.ajax({
                            url: $rootScope.base_url+'/access_points/delete_fusion',
                            type: 'POST',
                            data: {id:fusion.id, client_id:self.client_id, sharedDatabase:$rootScope.Connections.sharedDatabase},
                            success:function(response){
                                if(response.status == 0){
                                    $rootScope.alert_message($rootScope.Users.translateText('<h6>Erro ao remover emenda</h6>'));                                                                                                               
                                    $rootScope.dialogService.cancel('accessPoint');
                                    $rootScope.Connections.isLoading = true; 
                                    self.openAccessPoint($rootScope.Connections.accessPointOpened).then(function(){
                                        $rootScope.Connections.isLoading = false; 
                                    });
                                }else{
                                    // no host nunca tem circulo ... noos outros caos
                                    angular.forEach(self.circles, function(el,index){
                                        if(el){
                                            if(fusion.access_point_connection_id_in == el.connection_in && fusion.fiber_in == el.fiber_in){
                                                self.circles.splice(index,1);
                                            }else if(fusion.access_point_connection_id_in == el.connection_out && fusion.fiber_in == el.fiber_out){
                                                self.circles.splice(index,1);
                                            }                   
                                        }
                                    });
                                    //Delete IN part of path
                                    //Delete color path
                                    angular.forEach(self.paths, function(el,index){
                                        if(el){
                                            if(fusion.access_point_connection_id_in == el.connection_id && fusion.fiber_in == el.fiber){
                                                self.paths.splice(index,2);
                                            }                   
                                        }
                                    });
                                    //Delete black path
                                    angular.forEach(self.black_stripe_paths, function(el,index){
                                        if(el){
                                            if(fusion.access_point_connection_id_in == el.connection_id && fusion.fiber_in == el.fiber){
                                                self.black_stripe_paths.splice(index,2);
                                            }                   
                                        }
                                    });
                                    //Delete white path
                                    angular.forEach(self.white_stripe_paths, function(el,index){
                                        if(el){
                                            if(fusion.access_point_connection_id_in == el.connection_id && fusion.fiber_in == el.fiber){
                                                self.white_stripe_paths.splice(index,2);
                                            }                   
                                        }
                                    });
                                    //_____________________________________________________________
                                    //Delete OUT part of path
                                    angular.forEach(self.paths, function(el,index){
                                        if(el){
                                            if(fusion.access_point_connection_id_out == el.connection_id && fusion.fiber_out == el.fiber){
                                                self.paths.splice(index,2);
                                            }                   
                                        }
                                    });
                                    //Delete OUT part of path
                                    angular.forEach(self.black_stripe_paths, function(el,index){
                                        if(el){
                                            if(fusion.access_point_connection_id_out == el.connection_id && fusion.fiber_out == el.fiber){
                                                self.black_stripe_paths.splice(index,2);
                                            }                   
                                        }
                                    }); 
                                    //Delete OUT part of path
                                    angular.forEach(self.white_stripe_paths, function(el,index){
                                        if(el){
                                            if(fusion.access_point_connection_id_out == el.connection_id && fusion.fiber_out == el.fiber){
                                                self.white_stripe_paths.splice(index,2);
                                            }                   
                                        }
                                    });
                                    
                                    // Delete fusion from fusion list in connections
                                    angular.forEach($rootScope.Connections.connections.fusions, function(current_fusion, current_idx){
                                    	if (current_fusion){
	                                    	if (current_fusion.id == fusion.id){
	                                    		$rootScope.Connections.connections.fusions.splice(current_idx, 1);
	                                    	}
                                    	}
                                    });

                                    source = [];
                                    target = [];
                                    source.id = fusion.access_point_connection_id_in+'_'+fusion.fiber_in;                                    
                                    target.id = fusion.access_point_connection_id_out+'_'+fusion.fiber_out;
                                    self.checkSlot(source,0);
                                    self.checkSlot(target,0);
                                    self.setarRotaReload(fusion);
                                    self.refreshSplitterOutputs(fusion);

									if(self.client_id){
										// $rootScope.Clients.redrawClient(self.client_id);
										$rootScope.Clients.clients.filter(c => c.id === self.client_id).forEach(client =>{
											client.splitter_id = null;
											client.splitter_port = null;
											$rootScope.Nodes.changeNodeIcon(4, client);
										});
										
									}
									
                                    $rootScope.$apply();
                                }
                            }
                        });    
                    }                    
                }
            },function(){
                $rootScope.alert_message($rootScope.Users.translateText('Emenda não encontrada'));
                return;                                
            });
        },
        
        //Apos adicionar ou deletar uma fusao, setar toda a rota (para as duas direcoes) para reload
        setarRotaReload : function(fusion){
    		var i;
        	if (fusion.host_id){
            	for (i = 0; i < $rootScope.Connections.savedReportsSlots.length; i++){
            		if (($rootScope.Connections.savedReportsSlots[i]['fiber_number'] == fusion.fiber) && ($rootScope.Connections.savedReportsSlots[i]['conn_id'] == fusion.connection_id)){
            			angular.forEach($rootScope.Connections.savedReportsSlots[i].report_data.fusions, function(current_fusion, idx){
	        				$rootScope.Connections.reloadReportsFusions.push(current_fusion.id);
	        			});
            			//Find the last slot (the ending of the fiber path)
            			if ($rootScope.Connections.savedReportsSlots[i].host_port){
            				//If there's a host in the end, take the conn and fiber numbers.
            				var slot = {};
            				slot.fiber = $rootScope.Connections.savedReportsSlots[i].host_port.fiber;
            				slot.connection_id = $rootScope.Connections.savedReportsSlots[i].host_port.connection_id;
            				$rootScope.Connections.reloadReportsSlots.push(slot);
            			} else {
            				//If there's no host, find the last connection and fiber number
            				if ($rootScope.Connections.savedReportsSlots[i].last_slot_fiber != null){
            					var slot = {};
            					slot.fiber = $rootScope.Connections.savedReportsSlots[i].last_slot_fiber;
            					slot.connection_id = $rootScope.Connections.savedReportsSlots[i].last_slot_conn;
            					$rootScope.Connections.reloadReportsSlots.push(slot);
            				}
            			}
            			
            			// Set splitter outputs if there's a splitter and the fusion is connected to its input
            			
            			break;
            		}
            	}
        	} else {
	        	for (i = 0; i < $rootScope.Connections.savedReportsFusions.length; i++){
	        		if ($rootScope.Connections.savedReportsFusions[i]['fusion'].id == fusion.id){
	        			
	        			//Set all fusions in the route report to be reloaded.
	        			angular.forEach($rootScope.Connections.savedReportsFusions[i].report_in.fusions, function(current_fusion, idx){
	        				$rootScope.Connections.reloadReportsFusions.push(current_fusion.id);
	        			});
	        			//Check the last slot
	        			if ($rootScope.Connections.savedReportsFusions[i].report_in.host_port){
	        				var slot = {};
            				slot.fiber = $rootScope.Connections.savedReportsFusions[i].report_in.host_port.fiber;
            				slot.connection_id = $rootScope.Connections.savedReportsFusions[i].report_in.host_port.connection_id;
            				$rootScope.Connections.reloadReportsSlots.push(slot);
	        			} else {
	        				if ($rootScope.Connections.savedReportsFusions[i].report_in.last_slot_fiber != null){
	        					var slot = {};
            					slot.fiber = $rootScope.Connections.savedReportsFusions[i].report_in.last_slot_fiber;
            					slot.connection_id = $rootScope.Connections.savedReportsFusions[i].report_in.last_slot_conn;
	        					$rootScope.Connections.reloadReportsSlots.push(slot);
	        				}
	        			}
	        			angular.forEach($rootScope.Connections.savedReportsFusions[i].report_out.fusions, function(current_fusion, idx){
	        				$rootScope.Connections.reloadReportsFusions.push(current_fusion.id);
	        			});
	        			//Check the last slot
	        			if ($rootScope.Connections.savedReportsFusions[i].report_out.host_port) {
	        				var slot = {};
            				slot.fiber = $rootScope.Connections.savedReportsFusions[i].report_out.host_port.fiber;
            				slot.connection_id = $rootScope.Connections.savedReportsFusions[i].report_out.host_port.connection_id;
            				$rootScope.Connections.reloadReportsSlots.push(slot);
	        			} else {
	        				if ($rootScope.Connections.savedReportsFusions[i].report_out.last_slot_fiber != null){
	        					var slot = {};
            					slot.fiber = $rootScope.Connections.savedReportsFusions[i].report_out.last_slot_fiber;
            					slot.connection_id = $rootScope.Connections.savedReportsFusions[i].report_out.last_slot_conn;
            					$rootScope.Connections.reloadReportsSlots.push(slot);
	        				}
	        			}
	        			//Delete current fusion, since it has been deleted!
	    				$rootScope.Connections.savedReportsFusions.splice(i);
	        		}
	        	}
        	}
        },

        cancelAnimate : function(){
        	slot.connected = 0;
        	self.cont_slots = 0;
        	if(self.sourceAnimate){
        	    self.checkSlot(self.sourceAnimate, 0);
        	}
        	self.sourceAnimate = null;
        },
        
        refreshSplitterOutputs : function(fusion){
        	// Check if any of the fusion connections is an input to a splitter
        	var splitter = null;
        	if (!fusion.access_point_connection_in || !fusion.access_point_connection_out){
        		console.warn("MAPWISP - ERROR - This fusion doesn't have connection data loaded into it");
        		return;
        	}
        	if (fusion.access_point_connection_in.splitter_id && (fusion.fiber_in == 0 || fusion.fiber_in == -1)){
        		splitter = fusion.access_point_connection_in;
        	} else if (fusion.access_point_connection_out.splitter_id && (fusion.fiber_out == 0 || fusion.fiber_out == -1)){
        		splitter = fusion.access_point_connection_out
        	}
        	if (!splitter){
        		// Return if no splitter was found
        		return;
        	}
        	var fusions;
        	$.ajax({
                url: $rootScope.base_url+'/access_points/list_fusions',
                type: 'POST',
                data: {id: $rootScope.Connections.accessPointOpened.id},
                async: false,
                success:function(response){
                	fusions = response;
                }
            });    
        	
        	var connection = self.findConnection(splitter.id);
        	if (connection.splitter_id){
    			for(i = 0; i < connection.slots.length; i++){
        			if (self.slotFree(i, connection.id, fusions)){
        				// Setar este slot para reload
        				slot = {
        						fiber: i,
        						connection_id: connection.id
        				};
        				$rootScope.Connections.reloadReportsSlots.push(slot);
        				// Atualizar slot
        				self.updateNoFusion(i, $rootScope.Connections.accessPointOpened.id, connection.id);
        			} else {
        				// Setar esta fusion para reload
        				$rootScope.Connections.reloadReportsFusions.push(self.slotNotFreeFusion.id);
        				
        				// Atualizar fusion
        				self.updateFusion(self.slotNotFreeFusion);
        				
        				// Limpar var
        				self.slotNotFreeFusion = null;
        			}
        		}
    		}
        },

        createFusion : function(fusionData){
            // Primeiramente, impedindo usuario level 1 de fazer qualquer alteracao.
			if(LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_VIEW, LevelsAndModes.levels.NIVEL_VIEWEXPORT])){
				return;
			}

            // TODO Move this to slotclick and prevent clicks there
            // Caso seja de um banco compartilhado, impede se não for um splitter ou se for entrada de um splitter
			// if($rootScope.Connections.sharedDatabase){
			// 	if( slot.report_data && 
            //         (jQuery.isEmptyObject(slot.report_data.splitters)|| slot.fiber === 0)
            //     ){
			// 		$rootScope.alert_message($rootScope.Users.translateText("Não permitido. Esse ponto de acesso pertence a outro identificador."));  
	        //     	return;
			// 	}
			// }

            // Easy access for source and target
            let source = fusionData[0];
            let target = fusionData[1];

            // If is host, edit port
            if (source.connection_type == "host" || target.connection_type == "host"){
                return self.createHostFusion(source, target);
            } else {
                return self.createGeneralFusion(source, target);
            }
        },

        /**
         * Create a fusion between items that are NOT hosts
         * @param {*} source 
         * @param {*} target 
         */
        createGeneralFusion : function(source, target){
            // Prepare data
            dataSend = {};
            dataSend.access_point_connection_id_in = source.connection_id;
            dataSend.access_point_connection_id_out = target.connection_id;
            dataSend.fiber_in = source.fiber;
            dataSend.fiber_out = target.fiber;
            dataSend.connection_type = (source.connection_type == "cable" && target.connection_type == "cable" && source.cable_id == target.cable_id && source.fiber == target.fiber) ? 0 : 1; // 1 = fusão, 0 = passagem
            dataSend.loss = (source.connection_type == "cable" && target.connection_type == "cable" && source.cable_id == target.cable_id && source.fiber == target.fiber) ? 0 : 0.01; // 0.01 = fusão, 0 = passagem
            dataSend.draw_type =  0 ;
            dataSend.sharedDatabase = $rootScope.Connections.sharedDatabase;

            // If it is fusion to a client connection, send client id, splitter id and splitter port
            if(source.connection_type == "client"){
                dataSend.client_id = source.client_id;
                dataSend.splitter_id = target.splitter_id;
                dataSend.splitter_port = target.fiber;
            } else if(target.connection_type == "client"){
                dataSend.client_id = target.client_id;
                dataSend.splitter_id = source.splitter_id;
                dataSend.splitter_port = source.fiber;
            }
            dataSend.sharedDatabase = $rootScope.Connections.sharedDatabase;

            // Send request
            var result = {};
            $.ajax({
                url: $rootScope.base_url + "/access_points/add_fusion",
                type: "POST",
                data: dataSend,
                async: false,
                success:function(response){
                    console.log("ADD FUSION SUCCESS!", response);
                    result = {
                        "success" : response.status == 1,
                        "data": response.data,
                        "errors": response.errors
                    };

                    //Fazendo outro request pra pegar dados das fibras ativas
                    //pois o request anterior não traz algumas informações
                    if(response.status == 1){                            
                        $.ajax({
                            url: $rootScope.base_url+'/access_points/get_fusion',
                            type: 'POST',
                            data: {	id: response.id, sharedDatabase: $rootScope.Connections.sharedDatabase},
                            success:function(responseFusion){ 

                                //adiciona a nova fusão para ser usada no D3
                                $rootScope.Connections.connections['fusionsD3'].push(responseFusion);
                                
                                //Define the direction of the new fiber drawing in the AP
                                if (responseFusion.active){
                                    //Se os dois lados da fusao estiverem na mesma conexao, 
                                    //a direcao eh dada pelo numero da fibra da origem do fluxo
                                    if (source.connection_id == target.connection_id){
                                        if (responseFusion.data_direction['fiber'] == source.fiber){
                                            source.direction = 1;
                                            target.direction = 2;

                                            self.animateFiberD3(responseFusion,"in");
                                            //atualiza a fusão criada no D3
                                            result.data.directionD3 = "in";

                                        } else {
                                            source.direction = 2;
                                            target.direction = 1;

                                            self.animateFiberD3(responseFusion,"out");

                                            result.data.directionD3 = "out";

                                        }
                                    //se os lados da fusao estiverem em conexoes diferentes, 
                                    //o numero da conexao eh suficiente para determinar a direcao do fluxo
                                    } else {
                                        if (responseFusion.data_direction['connection'] == source.connection_id){
                                            source.direction = 1;
                                            target.direction = 2;

                                            self.animateFiberD3(responseFusion,"in");

                                            result.data.directionD3 = "in";

                                        } else {
                                            source.direction = 2;
                                            target.direction = 1;

                                            self.animateFiberD3(responseFusion,"out");

                                            result.data.directionD3 = "out";

                                        }
                                    }
                                } else {
                                    source.direction = 0;
                                    target.direction = 0;
                                }
                            }
                        });
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

            return result;
        },

        /**
         * Create a fusion that connects to a host on at least one side
         * @param {*} source 
         * @param {*} target 
         */
        createHostFusion : function(source, target){

            dataSend = {};

            if(source.connecting_host || target.connecting_host){
                dataSend.port_id = target.port_id;
                dataSend.id = source.port_id;
            }else if(source.host_port){
                dataSend.connection_id = target.connection_id;
                dataSend.fiber = target.fiber; 
                dataSend.id = source.port_id;
            }else{
                dataSend.connection_id = source.connection_id;
                dataSend.fiber = source.fiber; 
                dataSend.id = target.port_id;
            }

            var result = {};
            $.ajax({
                url: $rootScope.base_url+'/hosts/edit_port',
                type: 'POST',
                data: dataSend,
                async: false,
                success:function(response){
                    if(response.status == 1){  
                        //encontrar o a porta do host e editar ela
                        angular.forEach($rootScope.Connections.hosts, function(host,index){
                            angular.forEach(host.ports, function(port,index){                                            
                                if(port.id == dataSend.id){
									if(dataSend.port_id){
										port.port_id = dataSend.port_id;
									}else{
										port.fiber = dataSend.fiber; 
	                                    port.connection_id = dataSend.connection_id;	
									}
                                    
                                    port.side = "left";
									response.data = port;
                                    self.setarRotaReload(port);
                                    self.refreshSplitterOutputs(port);
                                }
                            });
                        });
                        result = {
                            "success" : response.status == 1,
                            "data": response.data,
                            "errors": response.errors
                        };
                    }
                    if(response.status == 0){  
                        $rootScope.alert_message($rootScope.Users.translateText('<h6>Erro ao cadastrar emenda</h6>'));                             
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

            return result;
            
        },

		connect : function($event,slot,host_port,client_conn){
			//Primeiramente, impedindo usuario level 1 de fazer qualquer alteracao.
			if(LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_VIEW, LevelsAndModes.levels.NIVEL_VIEWEXPORT])){
				return;
			}
            if(slot.connected > 0){
            	if (slot.connected == 2){
            		self.cancelAnimate(slot);
            		slot.connected = 0;
            	} else {
	                $rootScope.alert_message($rootScope.Users.translateText('Esta fibra ja esta conectada/selecionada'));
	            }
            	return;
            }

			if($rootScope.Connections.sharedDatabase){
				//Impede caso não seja um splitter ou seja entrada de um splitter
				if(slot.report_data && (jQuery.isEmptyObject(slot.report_data.splitters)
									   || slot.fiber === 0)){

					$rootScope.alert_message($rootScope.Users.translateText('Não permitido. Esse ponto de acesso pertence a outro identificador.'));
		            
	            	return;
				}
				
			}

            if(self.cont_slots == 0){
                self.cont_slots++;
                self.sourceAnimate = slot;
                self.source = slot;
                
                if (slot.client){
				self.source.Y = slot.y-12;
				self.source.X = slot.x;
                } else {
                	self.source.Y = $event.currentTarget.offsetTop + $event.currentTarget.offsetParent.offsetTop; 
                	self.source.X = $event.currentTarget.offsetWidth;
                }
                self.source.host_port = host_port;

                //"marcar o slot" par saber que ele ja esta conectado
                self.checkSlot(self.source,2);

            }else if(self.cont_slots == 1){
                self.target = slot;
                if (slot.client){
				self.target.Y = slot.y - 12;
				self.target.X = slot.x;
                } else {
                	self.target.Y = $event.currentTarget.offsetTop + $event.currentTarget.offsetParent.offsetTop; 
                	self.target.X = $event.currentTarget.offsetWidth;
                }
                self.target.host_port = host_port;
                if(self.target.col != self.source.col){
                	if (self.target.col == "B" || self.source.col == "B"){
                		type = 3;
                	} else {
                		type = 0;
                	}
                }else{
                    if((self.target.col == "L" )&&(self.source.col == 'L')){
                        type = 1;
                    }
                    if((self.target.col == "R" )&&(self.source.col == 'R')){
                        type = 2;
                    }
                }
                self.checkSlot(self.source,1);
                self.checkSlot(self.target,1);
                self.cont_slots++;
            }

            if(self.cont_slots == 2){
            	if (self.source['slot_number'] == 0){
            		conn_in = self.findConnection(self.source.connection_id);
            	}
            	if (self.target['slot_number'] == 0){
            		conn_out = self.findConnection(self.target.connection_id);
            	}
            	
                self.validateSlots(self.source,self.target).then(function(response){

                    self.cont_slots = 0;
                    if(self.target.host_port || self.source.host_port){
                        //desenhar conexão com o host
                            
                        if(self.source.host_port){
                            dataSend = {};
                            dataSend.connection_id = self.target.connection_id;
                            dataSend.fiber = self.target.fiber; 
                            dataSend.id = self.source.id;
                        }else{
                            dataSend = {};
                            dataSend.connection_id = self.source.connection_id;
                            dataSend.fiber = self.source.fiber; 
                            dataSend.id = self.target.id;
                        }

                        self.drawFusion(self.source,self.target, type,0);

                        $.ajax({
                            url: $rootScope.base_url+'/hosts/edit_port',
                            type: 'POST',
                            data: dataSend,
                            success:function(response){
                                if(response.status == 1){  
                                    //encontrar o a porta do host e editar ela
                                    angular.forEach($rootScope.Connections.hosts, function(host,index){
                                        angular.forEach(host.ports, function(port,index){                                            
                                            if(port.id == dataSend.id){
                                                port.fiber = dataSend.fiber; 
                                                port.connection_id = dataSend.connection_id;
                                                self.setarRotaReload(port);
                                                self.refreshSplitterOutputs(port);
                                            }
                                        });
                                    });
                                }
                                if(response.status == 0){  
                                    $rootScope.alert_message($rootScope.Users.translateText('<h6>Erro ao cadastrar emenda</h6>'));                             
                                }
                            }
                        });


                    }else{
                        dataSend = {};
                        dataSend.access_point_connection_id_in = self.source.connection_id;
                        dataSend.access_point_connection_id_out = self.target.connection_id;
                        dataSend.fiber_in = self.source.fiber;
                        dataSend.fiber_out = self.target.fiber; 
                        dataSend.connection_type =  0;
                        dataSend.draw_type =  0 ;
                        dataSend.loss = 0;

                        //encontrar as conexoes para encontrar os cabos para saber se faço uma fusao ou uma passagem
                        conn_in = self.findConnection(self.source.connection_id);
                        conn_out = self.findConnection(self.target.connection_id);

                        //verificar se é fusao
                        if(conn_in.cable_id != conn_out.cable_id || self.source.fiber != self.target.fiber){
                            dataSend.connection_type = 1;
                            dataSend.loss = 0.01;
                        }else{
                            dataSend.connection_type = 0;
                        }

                        self.source.connection_type = dataSend.connection_type;
                        self.target.connection_type = dataSend.connection_type;

                        self.client_id = null;

						if(!jQuery.isEmptyObject(conn_in.client)){
                            self.client_id = conn_in.client.id;
							dataSend.client_id = conn_in.client.id;
							dataSend.splitter_id = conn_out.splitter_id;
							dataSend.splitter_port = self.target.fiber;
						}else if(!jQuery.isEmptyObject(conn_out.client)){
                            self.client_id = conn_out.client.id;
							dataSend.client_id = conn_out.client.id;
							dataSend.splitter_id = conn_in.splitter_id;
							dataSend.splitter_port = self.source.fiber;
						}
                        dataSend.sharedDatabase = $rootScope.Connections.sharedDatabase;
                        
                        //self.drawFusion(source,target, type,dataSend.connection_type);                   
                        $rootScope.Connections.isLoading = true;
                        $.ajax({
                            url: $rootScope.base_url+'/access_points/add_fusion',
                            type: 'POST',
                            data: dataSend,
                            success:function(response){
                                if(response.status == 1){                            
                                    $.ajax({
                                        url: $rootScope.base_url+'/access_points/get_fusion',
                                        type: 'POST',
                                        data: {	id: response.id, sharedDatabase: $rootScope.Connections.sharedDatabase},
                                        success:function(response){                                        	
                                			//Save report for further use
                                        	var fusion_report = [];
                                        	fusion_report['report_in'] = response.report_data.report_in;
                                        	fusion_report['report_out'] = response.report_data.report_out;
                                        	delete response.report_data;
                                        	fusion_report['fusion'] = response;
                                			$rootScope.Connections.savedReportsFusions.push(fusion_report);
                                        	//Define the direction of the new fiber drawing in the AP
                                        	if (response.active){
                                        		//Se os dois lados da fusao estiverem na mesma conexao, 
                                        		//a direcao eh dada pelo numero da fibra da origem do fluxo
                                        		if (self.source.connection_id == self.target.connection_id){
                                        			if (response.data_direction['fiber'] == self.source.fiber){
                                        				self.source.direction = 1;
                                        				self.target.direction = 2;

                                                        self.animateFiberD3(response,"in");

                                        			} else {
                                        				self.source.direction = 2;
                                        				self.target.direction = 1;

                                                        self.animateFiberD3(response,"out");
                                        			}
                                        		//se os lados da fusao estiverem em conexoes diferentes, 
                                        		//o numero da conexao eh suficiente para determinar a direcao do fluxo
                                        		} else {
	                                        		if (response.data_direction['connection'] == self.source.connection_id){
	                                        			self.source.direction = 1;
	                                        			self.target.direction = 2;

                                                        self.animateFiberD3(response,"in");

	                                        		} else {
	                                        			self.source.direction = 2;
	                                        			self.target.direction = 1;

                                                        self.animateFiberD3(response,"out");

	                                        		}
                                        		}
                                        	} else {
                                        		self.source.direction = 0;
                                    			self.target.direction = 0;
                                        	}

                                        	//Draw fiber
											self.drawFusion(self.source,self.target, type,dataSend.connection_type, 1);//Passing this last argument as 1, to skip the deletion
                                        	
                                        	//Apply data on the rootScope
                                            $rootScope.Connections.connections.fusions.push(response);  
                                            
											if($rootScope.Connections.sharedDatabase){

												//exibe a opção de excluir a fusão caso pertença ao ident logado
												setDb(self.source);
												setDb(self.target);
												
											}

                                            self.setarRotaReload(response);

                                            if(self.client_id){
                                                // $rootScope.Clients.redrawClient(self.client_id);
                                                $rootScope.Clients.clients.filter(c => c.id === self.client_id).forEach(client =>{
                                                    client.splitter_id = dataSend.splitter_id;
                                                    client.splitter_port = dataSend.splitter_port;
                                                    $rootScope.Nodes.changeNodeIcon(4, client);
                                                });
                                            }

                                            $rootScope.$apply();
                                            self.isLoading = false;
                                            
                                            $timeout(function(){
                                            	// If the fusion was created on the input of a splitter, reload
                                            	// the reports on that splitter's outputs
                                            	self.refreshSplitterOutputs(response);
                                                $rootScope.Connections.isLoading = false;
                                            }, 50);
                                        }
                                    });
                                }
                                if(response.status == 0){
                                	self.isLoading = false;
                                    $rootScope.alert_message($rootScope.Users.translateText('<h6>Erro ao cadastrar emenda</h6>'));                            
                                }
                            }
                        });
                        self.isLoading = false;
                    }
                },function(response){
                    $rootScope.alert_message(response)
                    // como o ultimo click foi nvalido eu limpo a variavel do target
                    self.checkSlot(self.source,2);
                    self.checkSlot(self.target,0);
                    self.target = [];
                    self.cont_slots = 1;
                })
            }

			//usado para exibir a opção de excluir a fusão caso pertença ao ident logado
			function setDb(fusion){

				$rootScope.Connections.connections.connectionsLeft.filter(c2 => c2.slots.filter(s2 => 
					s2.connection_id === fusion.connection_id && s2.fiber === fusion.fiber).forEach(slot2 =>{
						slot2.db_tomodat = $rootScope.db_tomodat_local;
				}));

				$rootScope.Connections.connections.connectionsRight.filter(c2 => c2.slots.filter(s2 => 
					s2.connection_id === fusion.connection_id && s2.fiber === fusion.fiber).forEach(slot2 =>{
						slot2.db_tomodat = $rootScope.db_tomodat_local;
				}));
				
			}
		},

        animateFiberD3 : function(fusion,direction){

            //Guarda direção da fibra pra ser usada no novo layout
            $rootScope.Connections.connections.fusionsD3.filter(f => f.id === parseInt(fusion.id)).forEach(fusionD3 =>{
                fusionD3.directionD3 = direction;
                if($rootScope.apVisualizer){
                    $rootScope.apVisualizer.animateFiber(fusionD3);
                }
            });

        },

        connectMany : function(){

            var arrFus = {};
            var contIndex = 0;
            self.isLoading = true;

            $rootScope.Connections.tubeConnect.forEach(conn =>{

                var fus = {};

                fus.access_point_connection_id_in = conn.source.connection_id;
                fus.access_point_connection_id_out = conn.target.connection_id;
                fus.fiber_in = conn.source.fiber;
                fus.fiber_out = conn.target.fiber; 
                fus.connection_type =  0;
                fus.draw_type =  0 ;
                fus.loss = 0;

                //encontrar as conexoes para encontrar os cabos para saber se faço uma fusao ou uma passagem
                var conn_in = self.findConnection(conn.source.connection_id);
                var conn_out = self.findConnection(conn.target.connection_id);

                //verificar se é fusao
                if(conn_in.cable_id != conn_out.cable_id || conn.source.fiber != conn.target.fiber){
                    fus.connection_type = 1;
                    fus.loss = 0.01;
                }else{
                    fus.connection_type = 0;
                }

                conn.source.connection_type = fus.connection_type;
                conn.target.connection_type = fus.connection_type;

                arrFus[contIndex] = fus;
				contIndex++;

            });

            var dataSend = JSON.stringify(arrFus);          
            $.ajax({
                url: $rootScope.base_url+'/access_points/add_many_fusions',
                type: 'POST',
                data: {data:dataSend},
                dataType: "json",
                success:function(response){

                	var cont = 0;

                    response.forEach(fusion =>{

						//Save report for further use
						var fusion_report = [];
						fusion_report['report_in'] = fusion.report_data.report_in;
						fusion_report['report_out'] = fusion.report_data.report_out;
						delete fusion.report_data;
						fusion_report['fusion'] = fusion;

						$rootScope.Connections.savedReportsFusions.push(fusion_report);

                        var source = $rootScope.Connections.tubeConnect[cont].source;
                        var target = $rootScope.Connections.tubeConnect[cont].target;

						//Define the direction of the new fiber drawing in the AP
						if (fusion.active){
							//Se os dois lados da fusao estiverem na mesma conexao, 
							//a direcao eh dada pelo numero da fibra da origem do fluxo
							if (source.connection_id == target.connection_id){
								if (fusion.data_direction['fiber'] == source.fiber){
									source.direction = 1;
									target.direction = 2;
								} else {
									source.direction = 2;
									target.direction = 1;
								}
							//se os lados da fusao estiverem em conexoes diferentes, 
							//o numero da conexao eh suficiente para determinar a direcao do fluxo
							} else {
								if (fusion.data_direction['connection'] == source.connection_id){
									source.direction = 1;
									target.direction = 2;
								} else {
									source.direction = 2;
									target.direction = 1;
								}
							}
						} else {
							source.direction = 0;
							target.direction = 0;
						}

                        if(target.col != source.col){
							if (target.col == "B" || source.col == "B"){
								type = 3;
							} else {
								type = 0;
							}
						}else{
							if((target.col == "L" )&&(source.col == 'L')){
								type = 1;
							}
							if((target.col == "R" )&&(source.col == 'R')){
								type = 2;
							}
						}

						//Draw fiber
						self.drawFusion(source,target, type,source.connection_type, 1); //Passing this last argument as 1, to skip the deletion
						//Apply data on the rootScope
						$rootScope.Connections.connections.fusions.push(fusion);   
						self.setarRotaReload(fusion);

						cont++;

						$rootScope.$apply() 

						$timeout(function(){
							// If the fusion was created on the input of a splitter, reload
							// the reports on that splitter's outputs
							self.refreshSplitterOutputs(fusion);
						}, 50);
				    });

				    $rootScope.Connections.tubeConnect = [];

				    $rootScope.Connections.connections.connectionsLeft.filter(c1 => c1.slots.filter(s1 => s1.tubeConnect).forEach(slot =>{
							slot.tubeConnect = false;
                            slot.connected = 1;
					}));

					$rootScope.Connections.connections.connectionsRight.filter(c2 => c2.slots.filter(s2 => s2.tubeConnect).forEach(slot =>{
							slot.tubeConnect = false;
                            slot.connected = 1;
					}));

					self.isLoading = false;

                },
            });

        },

        validateSlots : function(source,target){
            var d = $q.defer();
            var error = false;


            if(source.host_port){
                conn_in = self.findHost(source.host_id);
            }else{
                conn_in = self.findConnection(source.connection_id);
            }
            if(target.host_port){
                conn_out = self.findHost(target.host_id);
            }else{
                conn_out = self.findConnection(target.connection_id);
            }
            
            //verificar se nao é o mesmo slot do primeiro click

            if(source.host_port || target.host_port){
                if(source.host_port && target.host_port){
                    error = true
                    d.reject($rootScope.Users.translateText('Você não pode conectar duas portas de equipamentos'));
                }
                if(conn_in.splitter_id && source.fiber > 0){
                    error = true
                    d.reject($rootScope.Users.translateText('Você não pode conectar portas de um equipamento com a saida de um splitter'));
                }
                if(conn_out.splitter_id && target.fiber > 0){
                    error = true
                    d.reject($rootScope.Users.translateText('Você não pode conectar portas de um equipamento com a saida de um splitter'));
                }
            } else if (source.client || target.client){
            	if(source.client && target.client){
                    error = true
                    d.reject($rootScope.Users.translateText('Você não pode conectar dois clientes'));
                }
            	if (conn_in.splitter_id && source.fiber == 0){
            		 error = true
                     d.reject($rootScope.Users.translateText('Você não pode conectar um cliente à entrada de um splitter'));
            	} 
            	if (conn_out.splitter_id && source.fiber == 0){
            		 error = true
                     d.reject($rootScope.Users.translateText('Você não pode conectar um cliente à entrada de um splitter'));
            	}
            } else{
                if(source.fiber == target.fiber && source.connection_id == target.connection_id){
                    error = true
                    d.reject($rootScope.Users.translateText('Você não pode ligar uma fibra nela mesma'));
                }

                if(conn_in.splitter_id && conn_out.splitter_id){
                    if(conn_in.splitter_id == conn_out.splitter_id){
                        error = true
                        d.reject($rootScope.Users.translateText('Você não pode ligar um splitter nele mesmo'));
                    }else if((source.fiber == 0 && target.fiber == 0)){
                        error = true
                        d.reject($rootScope.Users.translateText('Você não pode ligar uma entrada de splitter em outra entrada de splitter'));
                    }else if((source.fiber > 0 && target.fiber > 0)){
                        error = true
                        d.reject($rootScope.Users.translateText('Você não pode ligar duas saidas de splitter'));
					}else if($rootScope.Connections.connections.fusions.filter(f=>(f.access_point_connection_in.splitter_id === conn_in.splitter_id
					 && f.access_point_connection_out.splitter_id === conn_out.splitter_id)
                     || (f.access_point_connection_in.splitter_id === conn_out.splitter_id
					 && f.access_point_connection_out.splitter_id === conn_in.splitter_id))[0]){
                        
                        error = true
                        d.reject($rootScope.Users.translateText('Impossível conectar splitters dessa forma, pois entraria em loop infinito'));
                    }
                }

                
                if(conn_in.cable.category  == 2 || conn_out.cable.category == 2){
                     if((conn_in.splitter_id && conn_in.splitter.type < 2) || (conn_out.splitter_id && conn_out.splitter.type < 2)){
                        error = true
                        d.reject($rootScope.Users.translateText('Você não pode ligar um cabo UTP em um splitter'));
                     }
                }

                if(conn_in.cable.category  == 2 || conn_out.cable.category == 2){
                    if((conn_in.splitter_id && source.fiber == 0 && conn_in.splitter.type == 3) || (conn_out.splitter_id && target.fiber == 0 && conn_out.splitter.type == 3)){
                       error = true
                       d.reject($rootScope.Users.translateText('Você não pode ligar um cabo UTP na entrada de uma PACPON'));
                    }
                }
             
                if(conn_in.cable.category  == 1 || conn_out.cable.category == 1){
                    if((conn_in.splitter_id && source.fiber > 0 && conn_in.splitter.type == 3) || (conn_out.splitter_id && target.fiber > 0 && conn_out.splitter.type == 3)){
                       error = true
                       d.reject($rootScope.Users.translateText('Você não pode ligar uma fibra nas saidas de uma PACPON. Utilize a porta 0 como entrada.'));
                    }
                }
                
                if(conn_in.cable.category  == 1 || conn_out.cable.category == 1){
                    if((conn_in.splitter_id && conn_in.splitter.type == 2) || (conn_out.splitter_id && conn_out.splitter.type == 2)){
                       error = true
                       d.reject($rootScope.Users.translateText('Você não pode ligar uma fibra em uma PAC.'));
                    }
                }
                
                if(!conn_in.cable && conn_out.cable){                 
                    if(conn_in.cable.category !=  conn_out.cable.category){
                        error = true
                        d.reject($rootScope.Users.translateText('Você não pode ligar um cabo UTP em um cabo de fibra'));
                    }
                }

            }

           

            

            // switch(erro){
            //     case 1:
            //         d.reject('Você não pode ligar uma fibra nela mesma');
            //     break;
            // }

            if(!error){
                d.resolve();
            }

            return d.promise;
        },

        /*
         * Deletes all the paths where fiber1 and fiber2 match with the parameters
         * */
        deletePaths : function(is_host, fiber, host_or_conn_id, skip_delete){
        	if (self.paths.length > 0){  
        		if (is_host){
		            angular.forEach(self.paths, function(path, index_path){
			            if((path.port_id == fiber) && ((path.connection_id == host_or_conn_id) || (path.host_id == host_or_conn_id))){
			            	if (!skip_delete){
			            		deleted = self.paths.splice(index_path, 2);
			            	} else {
			            		deleted = self.paths.splice(index_path, 1);
			            	}
			            }
		            });
        		} else {
        			angular.forEach(self.paths, function(path, index_path){
			            if((path.fiber == fiber) && ((path.connection_id == host_or_conn_id) || (path.host_id == host_or_conn_id))){
			            	if (!skip_delete){	
			            		deleted = self.paths.splice(index_path, 2);
			            	} else {
			            		deleted = self.paths.splice(index_path, 1);
			            	}
			            }
		            });
        		}
        	}
        	
        	//Deletar linhas pretas
        	if (self.black_stripe_paths.length > 0){
        		angular.forEach(self.black_stripe_paths, function(black_path, index_path){
		            if((black_path.fiber == fiber) && ((black_path.connection_id == host_or_conn_id) || (black_path.host_id == host_or_conn_id))){
		            	if (!skip_delete){	
		            		deleted = self.black_stripe_paths.splice(index_path, 2);
		            	} else {
		            		deleted = self.black_stripe_paths.splice(index_path, 1);
		            	}
		            }
	            });
        	}
        	
        	//Deletar linhas brancas
        	if (self.white_stripe_paths.length > 0){
        		angular.forEach(self.white_stripe_paths, function(white_path, index_path){
		            if((white_path.fiber == fiber) && ((white_path.connection_id == host_or_conn_id) || (white_path.host_id == host_or_conn_id))){
		            	if (!skip_delete){	
		            		deleted = self.white_stripe_paths.splice(index_path, 2);
		            	} else {
		            		deleted = self.white_stripe_paths.splice(index_path, 1);
		            	}
		            }
	            });
        	}
        },

        /**
         * Draw Fusion Method
         * Draws all the paths necessary for a fusion drawing
         * 
         * @parameters: 
         * 		source - data about source of the line
         * 		target - data about target of the line
         * 		type - same side, different side, or client
         * 		connection_type - fusion or passage
         * 		skip_delete - true or false, used in the deletePaths method
         * 
         * */
        drawFusion : function(source,target,type,connection_type, skip_delete){
            source.Y = source.Y+12;
            target.Y = target.Y+12;
            meioY = 0;
            circle = [];

			var src = 0;

            //Verificar se conexao oposta eh um host. Nesse caso, existe fluxo "IN" = 1
            if (source.host_port){
            	target.direction = 1;
            } else if (target.host_port){
            	source.direction = 1;
            }
            
            //For the HOVER functionallity
            if(source.host_port){
            	source.slot_number = source.host_port;
            } else {
            	source.slot_number = source.fiber;
            }
            if (target.host_port){
            	target.slot_number = target.host_port;
            } else {
            	target.slot_number = target.fiber;
            }
            
            //para casos de utp e host
            if(source.code_color == 0 || !source.code_color){
                source.color_fiber = 0;
            }
            if(target.code_color == 0 || !target.code_color){
                target.color_fiber = 0;
            }
            //fim dos casos utp e host
            
            //Para casos de fibra JET -> fibra com 24 fibras por tubo
            if (source.color_fiber > 12){
            	source.color_fiber = source.color_fiber - 12;
            	source.jet = true;
            }
            if (target.color_fiber > 12){
            	target.color_fiber = target.color_fiber - 12;
            	target.jet = true;
            }

            if(source.Y == target.Y){
                meioY = source.Y;
            }else if(source.Y > target.Y){
                //primeiro é maior
                meioY = (source.Y - target.Y)/2+target.Y;                
            }else{
                //segundo é maior
                meioY = (target.Y - source.Y)/2+source.Y;
            }

            self.cont_slots = 0;           
            self.posicoes =  source.Y+'/'+target.Y+' ->'+meioY;
            
            //---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
            //---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------	
            //On different sides - left and right
            if(type == 0){
                if((target.col == "L" )&&(source.col == 'R')){
                	
                    src = target;
                    tgt = source; 
                }
                if((target.col == "R" )&&(source.col == 'L')){
                    src = source;
                    tgt = target;
                }
                                
                if(src.host_port){
                	self.deletePaths(1,src.id, src.host_id, skip_delete);
                    self.paths.push({'direction' : 2, 'fiber1': src.slot_number, 'fiber2': tgt.slot_number, 'port_id': src.id,'host_id':src.host_id ,'x1': 0, 'y1':src.Y,'x2': 50, 'y2':src.Y, cor: 'black'});
                    self.paths.push({'direction' : 2, 'fiber1': src.slot_number, 'fiber2': tgt.slot_number, 'port_id': src.id,'host_id':src.host_id ,'x1': 50,'y1':src.Y,'x2': 359, 'y2': meioY, cor:'black' });                
                }else{
                	self.deletePaths(0,src.fiber, src.connection_id, skip_delete);
                    self.paths.push({'direction' : src.direction, 'fiber1': src.slot_number, 'fiber2': tgt.slot_number, 'fiber': src.fiber,'connection_id':src.connection_id ,'x1': 0, 'y1':src.Y,'x2': 50, 'y2':src.Y, cor: self.codeColor[src.code_color][src.color_fiber]});
                    self.paths.push({'direction' : src.direction, 'fiber1': src.slot_number, 'fiber2': tgt.slot_number, 'fiber': src.fiber,'connection_id':src.connection_id ,'x1': 50,'y1':src.Y,'x2': 359, 'y2': meioY, cor: self.codeColor[src.code_color][src.color_fiber]});                
                    if (src.jet){
                    	var color = self.codeColor[src.code_color][src.color_fiber];
                    	if((color == "white") || (color == "yellow") || (color == "pink") || (color == "aquamarine")){
                    		//Add black stripe for contrast
                    		self.black_stripe_paths.push({'direction' : src.direction, 'fiber1': src.slot_number, 'fiber2': tgt.slot_number, 'fiber': src.fiber,'connection_id':src.connection_id ,'x1': 0, 'y1':src.Y,'x2': 50, 'y2':src.Y, cor: "black"});
                            self.black_stripe_paths.push({'direction' : src.direction, 'fiber1': src.slot_number, 'fiber2': tgt.slot_number, 'fiber': src.fiber,'connection_id':src.connection_id ,'x1': 50,'y1':src.Y,'x2': 359, 'y2': meioY, cor: "black"});
                    	}
                    	//Add the white stripes in the center
                    	self.white_stripe_paths.push({'direction' : src.direction, 'fiber1': src.slot_number, 'fiber2': tgt.slot_number, 'fiber': src.fiber,'connection_id':src.connection_id ,'x1': 0, 'y1':src.Y,'x2': 50, 'y2':src.Y, cor: "white"});
                        self.white_stripe_paths.push({'direction' : src.direction, 'fiber1': src.slot_number, 'fiber2': tgt.slot_number, 'fiber': src.fiber,'connection_id':src.connection_id ,'x1': 50,'y1':src.Y,'x2': 359, 'y2': meioY, cor: "white"});                
                    }
                }
                if(tgt.host_port){
                	self.deletePaths(1,src.id, src.host_id, skip_delete);
                    self.paths.push({'direction' : 2, 'fiber1': src.slot_number, 'fiber2': tgt.slot_number, 'port_id': src.id,'host_id':tgt.host_id ,'x1': 0, 'y1':src.Y,'x2': 50, 'y2':src.Y, cor: 'black'});
                    self.paths.push({'direction' : 2, 'fiber1': src.slot_number, 'fiber2': tgt.slot_number, 'port_id': src.id,'host_id':tgt.host_id ,'x1': 50,'y1':src.Y,'x2': 359, 'y2': meioY, cor: 'black'});                   
                }else{
                	self.deletePaths(0,tgt.fiber, tgt.connection_id, skip_delete);
                    self.paths.push({'direction' : tgt.direction, 'fiber1': src.slot_number, 'fiber2': tgt.slot_number, 'fiber': tgt.fiber,'connection_id':tgt.connection_id,'x1': 718, 'y1':tgt.Y,'x2': 668, 'y2':tgt.Y, cor: self.codeColor[tgt.code_color][tgt.color_fiber]});
                    self.paths.push({'direction' : tgt.direction, 'fiber1': src.slot_number, 'fiber2': tgt.slot_number, 'fiber': tgt.fiber,'connection_id':tgt.connection_id,'x1': 668,'y1':tgt.Y,'x2': 359, 'y2': meioY, cor: self.codeColor[tgt.code_color][tgt.color_fiber]});
                    if (tgt.jet){
                    	var color = self.codeColor[tgt.code_color][tgt.color_fiber];
                    	if ((color == "white") || (color == "yellow") || (color == "pink") || (color == "aquamarine")){
                    		//Add black stripe for contrast
                    		self.black_stripe_paths.push({'direction' : tgt.direction, 'fiber1': src.slot_number, 'fiber2': tgt.slot_number, 'fiber': tgt.fiber,'connection_id':tgt.connection_id,'x1': 718, 'y1':tgt.Y,'x2': 668, 'y2':tgt.Y, cor: "black"});
                            self.black_stripe_paths.push({'direction' : tgt.direction, 'fiber1': src.slot_number, 'fiber2': tgt.slot_number, 'fiber': tgt.fiber,'connection_id':tgt.connection_id,'x1': 668,'y1':tgt.Y,'x2': 359, 'y2': meioY, cor: "black"});
                    	}
                    	//Add the white stripes in the center
                    	self.white_stripe_paths.push({'direction' : tgt.direction, 'fiber1': src.slot_number, 'fiber2': tgt.slot_number, 'fiber': tgt.fiber,'connection_id':tgt.connection_id,'x1': 718, 'y1':tgt.Y,'x2': 668, 'y2':tgt.Y, cor: "white"});
                        self.white_stripe_paths.push({'direction' : tgt.direction, 'fiber1': src.slot_number, 'fiber2': tgt.slot_number, 'fiber': tgt.fiber,'connection_id':tgt.connection_id,'x1': 668,'y1':tgt.Y,'x2': 359, 'y2': meioY, cor: "white"});
                    }
                }


                if(!src.host_port){
                	self.deleteCircle(1, src.fiber, src.connection_id);
                    circle.fiber_in = src.fiber;
                    circle.connection_in = src.connection_id;
                }
                if(!tgt.host_port){
                	self.deleteCircle(2, tgt.fiber, tgt.connection_id);
                    circle.fiber_out = tgt.fiber;
                    circle.connection_out = tgt.connection_id;
                }

                circle.cy = meioY;
                circle.cx = 359;
                circle.r = 3;

                if(connection_type == 1){
                    self.circles.push(circle);    
                }
            //---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
            //---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------	
            // Type 3 for client connections - On different sides, left and bottom or right and bottom
            }else if (type == 3){
            	//Adjust in order to make the target always the client
            	if (source.client){
            		tgt = source;
            		src = target;
            	} else {
            		src = source;
            		tgt = target;
            	}
            	//No client will be connected to another client, so the source connection is always on one of the sides.
            	if (src.col == "L"){
            		//Source - 2 paths
                    if(src.host_port){
                    	self.deletePaths(1,src.id, src.host_id, skip_delete);
                        self.paths.push({'direction' : 2, 'fiber1': src.slot_number, 'fiber2': tgt.slot_number, 'port_id': src.id,'host_id':src.host_id ,'x1': 0, 'y1':src.Y,'x2': 50, 'y2':src.Y, cor: 'black'});
                    }else{
                    	self.deletePaths(0,src.fiber, src.connection_id, skip_delete);
                        self.paths.push({'direction' : src.direction, 'fiber1': src.slot_number, 'fiber2': tgt.slot_number, 'fiber': src.fiber,'connection_id':src.connection_id ,'x1': 0, 'y1':src.Y,'x2': 50, 'y2':src.Y, cor: self.codeColor[src.code_color][src.color_fiber]});
                        if (src.jet){
                        	var color = self.codeColor[src.code_color][src.color_fiber];
                        	if ((color == "white") || (color == "yellow") || (color == "pink") || (color == "aquamarine")){
                        		//Add black stripe for contrast
                        		self.black_stripe_paths.push({'direction' : src.direction, 'fiber1': src.slot_number, 'fiber2': tgt.slot_number, 'fiber': src.fiber,'connection_id':src.connection_id ,'x1': 0, 'y1':src.Y,'x2': 50, 'y2':src.Y, cor: "black"});
                        	}
                        	//Add white stripe
                        	self.white_stripe_paths.push({'direction' : src.direction, 'fiber1': src.slot_number, 'fiber2': tgt.slot_number, 'fiber': src.fiber,'connection_id':src.connection_id ,'x1': 0, 'y1':src.Y,'x2': 50, 'y2':src.Y, cor: "white"});
                        }
                    }
                    //Target - 2 paths
                	self.deletePaths(0,tgt.fiber, tgt.connection_id, skip_delete);
                    self.paths.push({'direction' : tgt.direction, 'fiber1': src.slot_number, 'fiber2': tgt.slot_number, 'fiber': tgt.fiber,'connection_id':tgt.connection_id,'x1': tgt.X + 10,'y1':tgt.Y,'x2': 50, 'y2': src.Y, cor: "blue"});
            	} else if (src.col == "R"){
            		//Source - 2 paths
                    if(src.host_port){
                    	self.deletePaths(1,src.id, src.host_id, skip_delete);
                        self.paths.push({'direction' : 2, 'fiber1': src.slot_number, 'fiber2': tgt.slot_number, 'port_id': src.id,'host_id':src.host_id ,'x1': 718, 'y1':src.Y,'x2': 668, 'y2':src.Y, cor: 'black'});
                    }else{
                    	self.deletePaths(0,src.fiber, src.connection_id, skip_delete);
                        self.paths.push({'direction' : src.direction, 'fiber1': src.slot_number, 'fiber2': tgt.slot_number, 'fiber': src.fiber,'connection_id':src.connection_id ,'x1': 718, 'y1':src.Y,'x2': 668, 'y2':src.Y, cor: self.codeColor[src.code_color][src.color_fiber]});
                        if (src.jet){
                        	var color = self.codeColor[src.code_color][src.color_fiber];
                        	if ((color == "white") || (color == "yellow") || (color == "pink") || (color == "aquamarine")){
                        		//Add black stripe for contrast
                        		self.black_stripe_paths.push({'direction' : src.direction, 'fiber1': src.slot_number, 'fiber2': tgt.slot_number, 'fiber': src.fiber,'connection_id':src.connection_id ,'x1': 718, 'y1':src.Y,'x2': 668, 'y2':src.Y, cor: "black"});
                        	}
                        	//Add white stripe
                        	self.white_stripe_paths.push({'direction' : src.direction, 'fiber1': src.slot_number, 'fiber2': tgt.slot_number, 'fiber': src.fiber,'connection_id':src.connection_id ,'x1': 718, 'y1':src.Y,'x2': 668, 'y2':src.Y, cor: "white"});
                        }
                    }
                    //Target - 2 paths
                	self.deletePaths(0,tgt.fiber, tgt.connection_id, skip_delete);
                    self.paths.push({'direction' : tgt.direction, 'fiber1': src.slot_number, 'fiber2': tgt.slot_number, 'fiber': tgt.fiber,'connection_id':tgt.connection_id,'x1': tgt.X + 10,'y1':tgt.Y,'x2': 668, 'y2': src.Y, cor: "blue"});
            	}
            	
            //---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
            //---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------	
            } else {
                if((target.col == "L" )&&(source.col == 'L')){
                	//self.deletePaths(source.slot_number, target.slot_number);
                    if(source.host_port){
                    	self.deletePaths(1,source.id, source.host_id, skip_delete);
                        self.paths.push({'direction' : 2, 'fiber1': source.slot_number, 'fiber2': target.slot_number, 'port_id': source.id,'host_id': source.host_id , 'x1': 0, 'y1':source.Y,'x2': 50+self.space, 'y2':source.Y, cor:'black'});
                        self.paths.push({'direction' : 2, 'fiber1': source.slot_number, 'fiber2': target.slot_number, 'port_id': source.id,'host_id': source.host_id , 'x1': 50+self.space,'y1':source.Y,'x2': 50+self.space, 'y2': meioY, cor:'black'});  
                    }else{
                    	self.deletePaths(0,source.fiber, source.connection_id, skip_delete);
                        self.paths.push({'direction' : source.direction, 'fiber1': source.slot_number, 'fiber2': target.slot_number, 'fiber': source.fiber,'connection_id': source.connection_id , 'x1': 0, 'y1':source.Y,'x2': 50+self.space, 'y2':source.Y, cor:self.codeColor[source.code_color][source.color_fiber]});
                        self.paths.push({'direction' : source.direction, 'fiber1': source.slot_number, 'fiber2': target.slot_number, 'fiber': source.fiber,'connection_id': source.connection_id , 'x1': 50+self.space,'y1':source.Y,'x2': 50+self.space, 'y2': meioY, cor:self.codeColor[source.code_color][source.color_fiber]});
                        if (source.jet){
                        	var color = self.codeColor[source.code_color][source.color_fiber];
                        	if ((color == "white") || (color == "yellow") || (color == "pink") || (color == "aquamarine")){
                        		//Add black stripe for contrast
                        		self.black_stripe_paths.push({'direction' : source.direction, 'fiber1': source.slot_number, 'fiber2': target.slot_number, 'fiber': source.fiber,'connection_id': source.connection_id , 'x1': 0, 'y1':source.Y,'x2': 50+self.space, 'y2':source.Y, cor:"black"});
                                self.black_stripe_paths.push({'direction' : source.direction, 'fiber1': source.slot_number, 'fiber2': target.slot_number, 'fiber': source.fiber,'connection_id': source.connection_id , 'x1': 50+self.space,'y1':source.Y,'x2': 50+self.space, 'y2': meioY, cor:"black"});
                        	}
                        	//Add white stripe
                        	self.white_stripe_paths.push({'direction' : source.direction, 'fiber1': source.slot_number, 'fiber2': target.slot_number, 'fiber': source.fiber,'connection_id': source.connection_id , 'x1': 0, 'y1':source.Y,'x2': 50+self.space, 'y2':source.Y, cor:"white"});
                            self.white_stripe_paths.push({'direction' : source.direction, 'fiber1': source.slot_number, 'fiber2': target.slot_number, 'fiber': source.fiber,'connection_id': source.connection_id , 'x1': 50+self.space,'y1':source.Y,'x2': 50+self.space, 'y2': meioY, cor:"white"});
                        }
                    }

                    if(target.host_port){
                    	self.deletePaths(1,target.id, target.host_id, skip_delete);
                        self.paths.push({'direction' : 2, 'fiber1': source.slot_number, 'fiber2': target.slot_number, 'port_id': target.id,'host_id': target.host_id ,'x1': 0, 'y1':target.Y,'x2': 50+self.space, 'y2':target.Y, cor:'black'});
                        self.paths.push({'direction' : 2, 'fiber1': source.slot_number, 'fiber2': target.slot_number, 'port_id': target.id,'host_id': target.host_id ,'x1': 50+self.space,'y1':target.Y,'x2': 50+self.space, 'y2': meioY, cor:'black'});
                    }else{
                    	self.deletePaths(0,target.fiber, target.connection_id, skip_delete);
                        self.paths.push({'direction' : target.direction, 'fiber1': source.slot_number, 'fiber2': target.slot_number, 'fiber': target.fiber,'connection_id': target.connection_id ,'x1': 0, 'y1':target.Y,'x2': 50+self.space, 'y2':target.Y, cor:self.codeColor[target.code_color][target.color_fiber]});
                        self.paths.push({'direction' : target.direction, 'fiber1': source.slot_number, 'fiber2': target.slot_number, 'fiber': target.fiber,'connection_id': target.connection_id ,'x1': 50+self.space,'y1':target.Y,'x2': 50+self.space, 'y2': meioY, cor:self.codeColor[target.code_color][target.color_fiber]});
                        if (target.jet){
                        	var color = self.codeColor[target.code_color][target.color_fiber];
                        	if ((color == "white") || (color == "yellow") || (color == "pink") || (color == "aquamarine")){
                        		//Add black stripe for contrast
                        		self.black_stripe_paths.push({'direction' : target.direction, 'fiber1': source.slot_number, 'fiber2': target.slot_number, 'fiber': target.fiber,'connection_id': target.connection_id ,'x1': 0, 'y1':target.Y,'x2': 50+self.space, 'y2':target.Y, cor:"black"});
                                self.black_stripe_paths.push({'direction' : target.direction, 'fiber1': source.slot_number, 'fiber2': target.slot_number, 'fiber': target.fiber,'connection_id': target.connection_id ,'x1': 50+self.space,'y1':target.Y,'x2': 50+self.space, 'y2': meioY, cor:"black"});
                        	}
                        	//Add white stripe
                        	self.white_stripe_paths.push({'direction' : target.direction, 'fiber1': source.slot_number, 'fiber2': target.slot_number, 'fiber': target.fiber,'connection_id': target.connection_id ,'x1': 0, 'y1':target.Y,'x2': 50+self.space, 'y2':target.Y, cor:"white"});
                            self.white_stripe_paths.push({'direction' : target.direction, 'fiber1': source.slot_number, 'fiber2': target.slot_number, 'fiber': target.fiber,'connection_id': target.connection_id ,'x1': 50+self.space,'y1':target.Y,'x2': 50+self.space, 'y2': meioY, cor:"white"});
                        }
                    }

                    if(!source.host_port){
                    	self.deleteCircle(1, source.fiber, source.connection_id);
                        circle.fiber_in = source.fiber;
                        circle.connection_in = source.connection_id;
                    }
                    if(!target.host_port){
                    	self.deleteCircle(2, target.fiber, target.connection_id);
                        circle.fiber_out = target.fiber;
                        circle.connection_out = target.connection_id;
                    }

                    circle.cy = meioY;
                    circle.cx = 50+self.space;
                }
                if((target.col == "R" )&&(source.col == 'R')){
                	//self.deletePaths(source.slot_number, target.slot_number);
                    if(source.host_port){
                    	self.deletePaths(1,source.id, source.host_id, skip_delete);
                        self.paths.push({'direction' : 2, 'fiber1': source.slot_number, 'fiber2': target.slot_number, 'port_id': source.id,'host_id': source.host_id , 'x1': 718, 'y1':source.Y,'x2': 668-self.space, 'y2':source.Y, cor:'black'});
                        self.paths.push({'direction' : 2, 'fiber1': source.slot_number, 'fiber2': target.slot_number, 'port_id': source.id,'host_id': source.host_id , 'x1': 668-self.space,'y1':source.Y,'x2': 668-self.space, 'y2': meioY, cor:'black'}); 
                    }else{
                    	self.deletePaths(0,source.fiber, source.connection_id, skip_delete);
                        self.paths.push({'direction' : source.direction, 'fiber1': source.slot_number, 'fiber2': target.slot_number, 'fiber': source.fiber,'connection_id': source.connection_id , 'x1': 718, 'y1':source.Y,'x2': 668-self.space, 'y2':source.Y, cor:self.codeColor[source.code_color][source.color_fiber]});
                        self.paths.push({'direction' : source.direction, 'fiber1': source.slot_number, 'fiber2': target.slot_number, 'fiber': source.fiber,'connection_id': source.connection_id , 'x1': 668-self.space,'y1':source.Y,'x2': 668-self.space, 'y2': meioY, cor:self.codeColor[source.code_color][source.color_fiber]});    
                        if (source.jet){
                        	var color = self.codeColor[source.code_color][source.color_fiber];
                        	if ((color == "white") || (color == "yellow") || (color == "pink") || (color == "aquamarine")){
                        		//Add black stripe for contrast
                        		self.black_stripe_paths.push({'direction' : source.direction, 'fiber1': source.slot_number, 'fiber2': target.slot_number, 'fiber': source.fiber,'connection_id': source.connection_id , 'x1': 718, 'y1':source.Y,'x2': 668-self.space, 'y2':source.Y, cor:"black"});
                                self.black_stripe_paths.push({'direction' : source.direction, 'fiber1': source.slot_number, 'fiber2': target.slot_number, 'fiber': source.fiber,'connection_id': source.connection_id , 'x1': 668-self.space,'y1':source.Y,'x2': 668-self.space, 'y2': meioY, cor:"black"}); 
                        	}
                        	//Add white stripe
                        	self.white_stripe_paths.push({'direction' : source.direction, 'fiber1': source.slot_number, 'fiber2': target.slot_number, 'fiber': source.fiber,'connection_id': source.connection_id , 'x1': 718, 'y1':source.Y,'x2': 668-self.space, 'y2':source.Y, cor:"white"});
                            self.white_stripe_paths.push({'direction' : source.direction, 'fiber1': source.slot_number, 'fiber2': target.slot_number, 'fiber': source.fiber,'connection_id': source.connection_id , 'x1': 668-self.space,'y1':source.Y,'x2': 668-self.space, 'y2': meioY, cor:"white"}); 
                        }
                    }
                    
                    if(target.host_port){
                    	self.deletePaths(1,target.id, target.host_id, skip_delete);
                        self.paths.push({'direction' : 2, 'fiber1': source.slot_number, 'fiber2': target.slot_number, 'port_id': target.id,'host_id': target.host_id ,'x1': 718, 'y1':target.Y,'x2': 668-self.space, 'y2':target.Y, cor: 'black'});
                        self.paths.push({'direction' : 2, 'fiber1': source.slot_number, 'fiber2': target.slot_number, 'port_id': target.id,'host_id': target.host_id ,'x1': 668-self.space,'y1':target.Y,'x2': 668-self.space, 'y2': meioY, cor:'black'});
                    }else{
                    	self.deletePaths(0,target.fiber, target.connection_id, skip_delete);
                        self.paths.push({'direction' : target.direction, 'fiber1': source.slot_number, 'fiber2': target.slot_number, 'fiber': target.fiber,'connection_id': target.connection_id ,'x1': 718, 'y1':target.Y,'x2': 668-self.space, 'y2':target.Y, cor: self.codeColor[target.code_color][target.color_fiber]});
                        self.paths.push({'direction' : target.direction, 'fiber1': source.slot_number, 'fiber2': target.slot_number, 'fiber': target.fiber,'connection_id': target.connection_id ,'x1': 668-self.space,'y1':target.Y,'x2': 668-self.space, 'y2': meioY, cor:self.codeColor[target.code_color][target.color_fiber]});
                        if (target.jet){
                        	var color = self.codeColor[target.code_color][target.color_fiber];
                        	if ((color == "white") || (color == "yellow") || (color == "pink") || (color == "aquamarine")){
                        		//Add black stripe for contrast
                        		self.black_stripe_paths.push({'direction' : target.direction, 'fiber1': source.slot_number, 'fiber2': target.slot_number, 'fiber': target.fiber,'connection_id': target.connection_id ,'x1': 718, 'y1':target.Y,'x2': 668-self.space, 'y2':target.Y, cor: "black"});
                                self.black_stripe_paths.push({'direction' : target.direction, 'fiber1': source.slot_number, 'fiber2': target.slot_number, 'fiber': target.fiber,'connection_id': target.connection_id ,'x1': 668-self.space,'y1':target.Y,'x2': 668-self.space, 'y2': meioY, cor:"black"});
                        	}
                        	//Add white stripe
                        	self.white_stripe_paths.push({'direction' : target.direction, 'fiber1': source.slot_number, 'fiber2': target.slot_number, 'fiber': target.fiber,'connection_id': target.connection_id ,'x1': 718, 'y1':target.Y,'x2': 668-self.space, 'y2':target.Y, cor:"white"});
                            self.white_stripe_paths.push({'direction' : target.direction, 'fiber1': source.slot_number, 'fiber2': target.slot_number, 'fiber': target.fiber,'connection_id': target.connection_id ,'x1': 668-self.space,'y1':target.Y,'x2': 668-self.space, 'y2': meioY, cor:"white"});
                        }
                    }
                    
                    
                    if(!source.host_port){
                    	self.deleteCircle(1, source.fiber, source.connection_id);
                        circle.fiber_in = source.fiber;
                        circle.connection_in = source.connection_id;
                    }
                    if(!target.host_port){
                    	self.deleteCircle(2, target.fiber, target.connection_id);
                        circle.fiber_out = target.fiber;
                        circle.connection_out = target.connection_id;
                    }

                    circle.cy = meioY;
                    circle.cx = 668-self.space;
                }            

                circle.r = 3;
                self.space = self.space+12;

                if(connection_type == 1){
                    self.circles.push(circle);    
                }                
                

            }
            meioY = 0;
        },

        deleteCircle : function(type, fiber, connection_id){
        	if (type == 1){
        		angular.forEach(self.circles, function(circle, indexCircle){
        			if ((circle.fiber_in == fiber) && (circle.connection_in == connection_id)){
        				self.circles.splice(indexCircle, 1);
        			}
        		})
        	} else if (type == 2){
        		angular.forEach(self.circles, function(circle, indexCircle){
        			if ((circle.fiber_out == fiber) && (circle.connection_out == connection_id)){
        				self.circles.splice(indexCircle, 1);
        			}
        		})
        	}
        },

        /**
         * Draw Fusion Tip function
         * 
         * Draws the beginnig of the fusion (only first path). This is for the fibers that are not connected in the access point
         * 
         * */
        drawFiberTip : function(fiber_number, ap_id, conn_id, report_data){

        	// Delete any paths that are on the same connectino, and same fiber_number
        	for (i = 0; i < self.paths.length; i++){
        		if (self.paths[i].connection_id == conn_id){
        			if (self.paths[i].fiber == fiber_number){
        				self.paths.splice(i, 1);
        			}
        		}
        	}
        	
        	//getting details about the connection
            var conn = self.findConnection(conn_id);
            if (conn === false){
                var errorData ={};
                errorData.error = "Didn't find connection when drawing fiber tip";
                errorData.file = "fusionsService.js";
                errorData.line = 1428;
                var extraInfo = {};
                extraInfo.fiber_number = fiber_number;
                extraInfo.ap_id = ap_id;
                extraInfo.conn_id = conn_id;
                errorData.extra_info = extraInfo;
                sendError(errorData);
                return;
            }
        	//Getting the source of the line
        	lineSource = angular.element(document.getElementById(conn_id+'_'+fiber_number));
        	
        	//------ Contructing the details for the line drawing ----- //
        	source = [];
            if(conn.splitter_id){
                source.code_color = 0;
                source.color_fiber = 0;
            }else{
                source.code_color = conn.cable.cable_type.code_color;
                source.color_fiber = fiber_number % (conn.cable.cable_type.number_fibers/conn.cable.cable_type.tubes);    
            }                    
            source.fiber = fiber_number;
            source.Y =  lineSource.context.offsetTop + lineSource.context.offsetParent.offsetTop;
            //offset the Y, to center it on the slot
            source.Y = source.Y+12;
            source.X =  lineSource.context.offsetWidth;
            source.connection_id = conn.id;
            source.id = conn.id+'_'+fiber_number;
            //Defining the side of the connection, in order to draw the line in the right direction
            if(conn.side == 'left' || conn.side == 'L'){
                source.col =  'L';
            }else{
                source.col =  'R';
            }
            // Specific case to fix the color of the fiber
            if((source.color_fiber == 0)&&(source.fiber>1)&&(!conn.splitter_id)){
                source.color_fiber = (conn.cable.cable_type.number_fibers/conn.cable.cable_type.tubes);  
            }else{
                if(source.color_fiber == 0){
                    source.color_fiber = 1;
                }
            }
            
            // JET FIBER CASE:
            // Check for cases where there are more than 12 fibers per tube
            // In those cases, to color will be the same order as before, but with a white stripe in the middle.
            // So when this happens, another svg path will be drawn
            var jet_fiber = false;
            if (source.color_fiber > 12){
            	var jet_fiber = true;
            	source.color_fiber = source.color_fiber - 12;
            }
            
            //Define the direction of the flow, if the fiber will be animated
            if (report_data.active){
            	//If the fiber is active, the direction is 2 (outside), as we are only drawing the tip of the fiber
            	source.direction = 2;
            } else {
            	source.direction = 0;
            }
            //----------------------------------------------------------//
            //------- DRAW THE PATH ------------------------------------//
            if (source.col == 'L'){
            	if (conn.splitter_id){
            		self.paths.push({'direction' : source.direction, 'fiber': source.fiber,'connection_id': source.connection_id , 'x1': 0, 'y1':source.Y,'x2': 50, 'y2':source.Y, cor:"grey"});            
            	} else {
            		self.paths.push({'direction' : source.direction, 'fiber': source.fiber,'connection_id': source.connection_id , 'x1': 0, 'y1':source.Y,'x2': 50, 'y2':source.Y, cor:self.codeColor[source.code_color][source.color_fiber]});            
            		if (jet_fiber){
            			if ((self.codeColor[source.code_color][source.color_fiber] == "white") || (self.codeColor[source.code_color][source.color_fiber] == "yellow") || (self.codeColor[source.code_color][source.color_fiber] == "pink") || (self.codeColor[source.code_color][source.color_fiber] == "aquamarine")){
            				self.black_stripe_paths.push({'direction' : source.direction, 'fiber': source.fiber,'connection_id': source.connection_id , 'x1': 0, 'y1':source.Y,'x2': 50, 'y2':source.Y, cor:"black"});
            			}
            			self.white_stripe_paths.push({'direction' : source.direction, 'fiber': source.fiber,'connection_id': source.connection_id , 'x1': 0, 'y1':source.Y,'x2': 50, 'y2':source.Y, cor:"white"});   
            		}
            	}
            } else {
            	if (conn.splitter_id){
            		self.paths.push({'direction' : source.direction, 'fiber': source.fiber,'connection_id': source.connection_id ,'x1': 718, 'y1':source.Y,'x2': 668, 'y2':source.Y, cor:"grey"});
            	} else {
            		self.paths.push({'direction' : source.direction, 'fiber': source.fiber,'connection_id': source.connection_id ,'x1': 718, 'y1':source.Y,'x2': 668, 'y2':source.Y, cor:self.codeColor[source.code_color][source.color_fiber]});
            		if (jet_fiber){
            			if ((self.codeColor[source.code_color][source.color_fiber] == "white") || (self.codeColor[source.code_color][source.color_fiber] == "yellow") || (self.codeColor[source.code_color][source.color_fiber] == "pink") || (self.codeColor[source.code_color][source.color_fiber] == "aquamarine")){
            				self.black_stripe_paths.push({'direction' : source.direction, 'fiber': source.fiber,'connection_id': source.connection_id ,'x1': 718, 'y1':source.Y,'x2': 668, 'y2':source.Y, cor:"black"});
            			}
            			self.white_stripe_paths.push({'direction' : source.direction, 'fiber': source.fiber,'connection_id': source.connection_id ,'x1': 718, 'y1':source.Y,'x2': 668, 'y2':source.Y, cor:"white"});
            		}
            	}
            }
        },
        
        drawFusions : function(connections){
            //usado para desenhar as linhas ao abrir a caixa;
            angular.forEach(connections.fusions,function(el,index){
                if(el && !el.hideTube){
                    fusion_id = el.id;
                    conn_in = self.findConnection(el.access_point_connection_id_in);
                    conn_out = self.findConnection(el.access_point_connection_id_out);
                    if(conn_in && conn_out){

                    currentSource = angular.element(document.getElementById(el.access_point_connection_id_in+'_'+el.fiber_in));//$(el.access_point_connection_id_in+'_'+el.fiber_in);
                    currentTarget = angular.element(document.getElementById(el.access_point_connection_id_out+'_'+el.fiber_out));//$(el.access_point_connection_id_out+'_'+el.fiber_out);


                    //source
                    source = [];  
                    if(conn_in.splitter_id){
                        source.code_color = 0;
                        source.color_fiber = 0;
                    } else if (conn_in.client){
                    	source.code_color = 0;
                    	source.color_fiber = 0;
                    } else {
                        source.code_color = conn_in.cable.cable_type.code_color;
                        source.color_fiber = el.fiber_in % (conn_in.cable.cable_type.number_fibers/conn_in.cable.cable_type.tubes); 
                        if(source.code_color === 8){   //Caso especial para padrão chinês que não repete as cores em cada tubo
                        	source.color_fiber = el.fiber_in;
                        }
                    }
                    source.fusion_id = fusion_id;
                    source.fiber = el.fiber_in;
                    if (conn_in.client){
					source.Y =  conn_in.y; 
					source.X =  conn_in.x;
                    	source.client = conn_in.client;
                    } else {
                    	source.Y =  !$rootScope.Connections.originalApShow ? 0 : currentSource.context.offsetTop + currentSource.context.offsetParent.offsetTop; 
                    	source.X =  !$rootScope.Connections.originalApShow ? 0 : currentSource.context.offsetWidth;
                    } 
                    source.connection_id = conn_in.id;
                    source.id = conn_in.id+'_'+el.fiber_in;
                 
                    if(conn_in.side == 'left'||conn_in.side == 'L'){
                        source.col =  'L';
                    } else if (conn_in.side == 'right'||conn_in.side == 'R'){
                        source.col =  'R';
                    } else if (conn_in.side == 'bottom' || conn_in.side == 'B'){
                    	source.col =  'B';
                    }
                    

                    if((source.color_fiber == 0)&&(source.fiber>1)&&(!conn_in.splitter_id)){
                        source.color_fiber = (conn_in.cable.cable_type.number_fibers/conn_in.cable.cable_type.tubes);  
                    }else{
                        if(source.color_fiber == 0){
                            source.color_fiber = 1;
                        }
                    }

                    //target
                    target = [];

                    if(conn_out.splitter_id){
                        target.code_color = 0;
                        target.color_fiber = 0;
                    } else if (conn_out.client){
                    	target.code_color = 0;
                        target.color_fiber = 0;
                    } else{
                        target.code_color = conn_out.cable.cable_type.code_color;
                        target.color_fiber = el.fiber_out % (conn_out.cable.cable_type.number_fibers/conn_out.cable.cable_type.tubes);
                        if(target.code_color === 8){   //Caso especial para padrão chinês que não repete as cores em cada tubo
                        	target.color_fiber = el.fiber_out;
                        }
                    }                  
                    target.fusion_id = fusion_id;                    
                    target.fiber = el.fiber_out;
                    target.id = conn_out.id+'_'+el.fiber_out;
                    if (conn_out.client){
                    	target.Y = conn_out.y;
                    	target.X = conn_out.x;
                    	target.client = conn_out.client;
                    } else {
                    	target.Y = !$rootScope.Connections.originalApShow ? 0 : currentTarget.context.offsetTop  + currentTarget.context.offsetParent.offsetTop; 
                    	target.X = !$rootScope.Connections.originalApShow ? 0 : currentTarget.context.offsetWidth;
                    }
                    target.connection_id = conn_out.id;
                    
                    //Parte que define a animacao do fluxo na fibra
                    if (el.active){
                    	if (source.connection_id == target.connection_id){
                    		if (source.fiber == el.data_direction['fiber']){
                    			source.direction = 1;
                    			target.direction = 2;

                                self.animateFiberD3(el,"in");

                    		} else {
                    			source.direction = 2;
                    			target.direction = 1;

                                self.animateFiberD3(el,"out");

                    		}
                    	} else {
		                    if(source.connection_id == el.data_direction['connection']){
		                    	source.direction = 1;
		                    	target.direction = 2;

                                self.animateFiberD3(el,"in");

		                    } else {
		                    	source.direction = 2;
		                    	target.direction = 1;

                                self.animateFiberD3(el,"out");

		                    }
                    	}
                    } else {
                    	source.direction = 0;
                    	target.direction = 0;
                    }
                    //=======================//
                    if(conn_out.side == 'left'||conn_out.side == 'L'){
                        target.col =  'L';
                    } else if (conn_out.side == 'right'||conn_out.side == 'R'){
                        target.col =  'R';
                    } else if (conn_out.side == 'bottom'|| conn_out.side == 'B'){
                        target.col =  'B';
                    }


                    if((target.color_fiber == 0)&&( target.fiber>1)&&(!conn_out.splitter_id)){
                        target.color_fiber = (conn_out.cable.cable_type.number_fibers/conn_out.cable.cable_type.tubes);  
                    }else{
                        if(target.color_fiber == 0){
                            target.color_fiber = 1;
                        }
                    }

                    self.setSlotLoss(el.loss, target);
                    self.setSlotLoss(el.loss, source);
                    if(target.col ==  source.col){
                        if(target.col == "L" && source.col == "L"){
                            self.drawFusion(source,target, 1, el.connection_type);
                            self.checkSlot(target, 1, el.connection_type);
                            self.checkSlot(source, 1, el.connection_type);
                        }else{
                            self.drawFusion(source,target, 2, el.connection_type);
                            self.checkSlot(target, 1, el.connection_type);
                            self.checkSlot(source, 1, el.connection_type);
                        } 
                    } else if (target.col == "B" || source.col == "B"){
                    	self.drawFusion(source, target, 3, el.connection_type);
                        self.checkSlot(target, 1, el.connection_type);
                        self.checkSlot(source, 1, el.connection_type);
                    } else {
                        self.drawFusion(source, target, 0, el.connection_type);
                        self.checkSlot(target, 1, el.connection_type);
                        self.checkSlot(source, 1, el.connection_type);
                    }
                }
                }

            });
            
            // elTeste =  angular.element(document.getElementById('9_1')); //usado pra pegar os elementos do DOM
        },

        setSlotLoss : function(loss, slot){
            var d = $q.defer();

            if(slot.id_html){
               id = slot.id_html; 
            }else{
               id = slot.id;
            }
            data = id.split('_');
            conn_id =  data[0];
            fiber  = data[1];
            
            //rodar todas as fusions e encotrar a qual tem a fibra x e a connection x para pedar o id da fusion
            angular.forEach($rootScope.Connections.connections.connectionsLeft, function(conn,indexConn){
                if(conn){
                    if(conn.id == conn_id){
                        angular.forEach(conn.slots, function(slotConn, indexSlot){
                            if(slotConn.id == id){
                                $rootScope.Connections.connections.connectionsLeft[indexConn].slots[indexSlot]['fusion_loss'] = loss;
                                d.resolve();
                            }
                        })
                    }
                }
            });    
            angular.forEach($rootScope.Connections.connections.connectionsRight, function(conn,indexConn){
                if(conn){
                    if(conn.id == conn_id){
                        angular.forEach(conn.slots, function(slotConn, indexSlot){
                            if(slotConn.id == id){
                                $rootScope.Connections.connections.connectionsRight[indexConn].slots[indexSlot]['fusion_loss'] = loss;
                                d.resolve();
                            }
                        })
                    }
                }
            }); 
            
            return d.promise;
        },
        
         drawFusionsHost : function(hosts){
            //usado para desenhar as linhas ao abrir a caixa;

            angular.forEach(hosts,function(host,index){
                if(host){
                    angular.forEach(host.ports,function(port,index){                    
                        conn_in = host; //a in sempre sera o host nestes casos
                        conn_out = self.findConnection(port.connection_id); //sempre vai ser o cabo ou splitter
                        currentSource = angular.element(document.getElementById(port.id_html));
                        currentTarget = angular.element(document.getElementById(port.connection_id+'_'+port.fiber));

                        if(conn_in &&conn_out && !port.hideTube){


                            // //source
                            source = [];   
                            source = port;
                            source.code_color = 0;
                            source.color_fiber = 0;
                            source.host_port = true;
                            source.Y =  !$rootScope.Connections.originalApShow ? 0 : currentSource.context.offsetTop + currentSource.context.offsetParent.offsetTop; 
                            source.X =  !$rootScope.Connections.originalApShow ? 0 : currentSource.context.offsetWidth;
                            source.col =  'L';
                            source.id_html = port.id_html;
                           
                       
                            //target
                            target = [];

                            if(conn_out.splitter_id){
                                target.code_color = 0;
                                target.color_fiber = 0;
                            }else{
                                target.code_color = conn_out.cable.cable_type.code_color;
                                target.color_fiber = port.fiber % (conn_out.cable.cable_type.number_fibers/conn_out.cable.cable_type.tubes);
                            }                  
                            target.port_id = port.id;                    
                            target.host_id = port.host_id; 
                            target.fiber = port.fiber;
                            target.id = port.connection_id+'_'+port.fiber;
                            target.Y = !$rootScope.Connections.originalApShow ? 0 : currentTarget.context.offsetTop  + currentTarget.context.offsetParent.offsetTop; 
                            target.X = !$rootScope.Connections.originalApShow ? 0 : currentSource.context.offsetWidth;
                            target.connection_id = conn_out.id;


                            if(conn_out.side == 'left'||conn_out.side == 'L'){
                                target.col =  'L';
                            }else{
                                target.col =  'R';
                            }

                            if((target.color_fiber == 0)&&( target.fiber>1)&&(!conn_out.splitter_id)){
                                target.color_fiber = (conn_out.cable.cable_type.number_fibers/conn_out.cable.cable_type.tubes);
                            }else{
                                if(target.color_fiber == 0){
                                    target.color_fiber = 1;
                                }
                            }

                            if(target.col ==  source.col){
                                if(target.col == "L" && source.col == "L"){
                                    self.drawFusion(source,target, 1,0);
                                    self.checkSlot(target,1,0);
                                    self.checkSlot(source,1,0);
                                }else{
                                    self.drawFusion(source,target, 2,0);
                                    self.checkSlot(target,1,0);
                                    self.checkSlot(source,1,0);
                                } 
                            }else{
                                self.drawFusion(source,target, 0,0);
                                self.checkSlot(target,1,0);
                                self.checkSlot(source,1,0);
                            }
                        }
                    });
                }

            });
            
            // elTeste =  angular.element(document.getElementById('9_1')); //usado pra pegar os elementos do DOM


        },

        
        /* New function - 24/02/2015 - 15:35
        * 
        * This function will get the report for each fusion individually, and dynamically present it in the view (accessPoint modal)
        * If the fusion is active, the svg line corresponding this line should be redrawn on screen, to show the flow of information
        *
        * Loads reports and animates fusion drawings
        *
        */
        loadReportsAnimate : function(accessPoint){
        	var d = $q.defer();
			var apId = accessPoint.sharedDatabase ? accessPoint.real_id : accessPoint.id;
            //self.isLoading = true;
        	//get all fusions of the accessPoint
        	$.ajax({
                url: $rootScope.base_url+'/access_points/list_fusions',
                type: 'POST',
                data: {id:apId,sharedDatabase : accessPoint.sharedDatabase},
                success:function(response){
                    self.fusionsInLoading = response;
                	angular.forEach(response, function(fusion, index_fusions){
                		
						//Se tiver sido efetuado corte de cabo, recarrega fusões
                		// if($rootScope.Cables.cableCut || $rootScope.Reserves.reserveAdded){
                            $rootScope.Connections.reloadReportsFusions.push(fusion.id);
                		// }

                		self.updateFusion(fusion,accessPoint.sharedDatabase);
                	});

                    if(jQuery.isEmptyObject(response)){
						$rootScope.Connections.apVisualizerLoadingFiberReports = false;
					}

                	self.loadReportsNoFusion(response, accessPoint);
                	d.resolve(response);
                }
            });       
        	return d.promise;
        },
  
        /*
         * Load reports no fusion method
         * Loads the report for all the slots with no fiber connected to them, in all
         * the access point connections
         * */
        loadReportsNoFusion : function(fusions, accessPoint){

            var apId = accessPoint.sharedDatabase ? accessPoint.real_id : accessPoint.id;
    
        	//for all the connections on the left
        	angular.forEach($rootScope.Connections.connections['connectionsLeft'], function(connection, index_connection){
        		if (connection.cable_id){
	        		for(var i = 1; i <= connection.cable.cable_type.number_fibers; i++){
	        			if (self.slotFree(i, connection.id, fusions)){
	        				self.updateNoFusion(i, apId, connection.id, accessPoint.sharedDatabase);
	        			}
	        		}
        		} else if (connection.splitter_id){
        			for(var i = 0; i < connection.slots.length; i++){
	        			if (self.slotFree(i, connection.id, fusions)){
	        				self.updateNoFusion(i, apId, connection.id, accessPoint.sharedDatabase);
	        			}
	        		}
        		}
        	})
        	//for all the connections on the right
        	angular.forEach($rootScope.Connections.connections['connectionsRight'], function(connection, index_connection){
        		if (connection.cable_id){
	        		for(var i = 1; i <= connection.cable.cable_type.number_fibers; i++){
	        			if (self.slotFree(i, connection.id, fusions)){
	        				self.updateNoFusion(i, apId, connection.id, accessPoint.sharedDatabase);
	        			}
	        		}
        		} else if (connection.splitter_id){
        			for(var i = 0; i < connection.slots.length; i++){
	        			if (self.slotFree(i, connection.id, fusions)){
	        				self.updateNoFusion(i, apId, connection.id, accessPoint.sharedDatabase);
	        			}
	        		}
        		}
        	})
        },
        
        reportAvailableSlot : function(fiber_number, conn_id){
        	//Check if it has to be reloaded
    		for (var i = 0; i < $rootScope.Connections.reloadReportsSlots.length; i++){
    			if (($rootScope.Connections.reloadReportsSlots[i].fiber == fiber_number) && ($rootScope.Connections.reloadReportsSlots[i].connection_id == conn_id)){
					$rootScope.Connections.reloadReportsSlots.splice(i, 1);
					return -1;
				}
    		}

        	for (var i = 0; i < $rootScope.Connections.savedReportsSlots.length; i++){
        		if (($rootScope.Connections.savedReportsSlots[i]['fiber_number'] == fiber_number) && ($rootScope.Connections.savedReportsSlots[i]['conn_id'] == conn_id)){
        			return i;
        		}
        	}
        	return -1;
        },
        
        /**
         * Update No Fusion method
         * For slots where there's no fusion connected, the report is called individually,
         * and the report is set in the slot.
         * */
        updateNoFusion : function(fiber_number, ap_id, conn_id,sharedDatabase){
        	//Check if report is already saved. If so, no need for all the ajax waiting!
        	//TODO also check if this report is outdated.
        	if (!self.reloadRoutes){
        		index = self.reportAvailableSlot(fiber_number, conn_id);
        	} else {
        		index = -1;
        	}
        	if (index != -1){
        		self.setReportSlot(index);
        	} else {
	        	var start = new Date().getTime();
	        	//get all fusions of the accessPoint
	        	let requestObject = $.ajax({
	                url: $rootScope.base_url+'/access_points/fiber_report',
	                type: 'POST',
	                data: {fiber_number:fiber_number, access_point_id:ap_id, connection_id:conn_id,sharedDatabase:sharedDatabase},
	                success:function(response){
	                	var enda = new Date().getTime();
	                	var timea = enda - start;
						//Save report for further use
	                	self.saveReportSlot(fiber_number, conn_id, response);
	                	
	                	//--------------------------------------------------------------------------
	                	// Check all connections on the left and on the right.
	                	// If the connection matches with the one this fusion is connected to,
	                	// add the report to the correct slot.
	                	//--------------------------------------------------------------------------
	                	angular.forEach($rootScope.Connections.connections['connectionsLeft'], function(connection, index_conn){
	                		if (connection.id == conn_id){
	                			angular.forEach(connection.slots, function(slot, index_slot){
	                				if (slot.fiber == fiber_number){
	                					$rootScope.Connections.connections['connectionsLeft'][index_conn].slots[index_slot].report_data = response;
                                        if (response.active && $rootScope.apVisualizer) $rootScope.apVisualizer.animateFiberTip(conn_id, fiber_number);
	                				}
	                			});
	                		}
	                	});
	                	angular.forEach($rootScope.Connections.connections['connectionsRight'], function(connection, index_conn){
	                		if (connection.id == conn_id){
	                			angular.forEach(connection.slots, function(slot, index_slot){
	                				if (slot.fiber == fiber_number){
	                					$rootScope.Connections.connections['connectionsRight'][index_conn].slots[index_slot].report_data = response;
                                        if (response.active && $rootScope.apVisualizer) $rootScope.apVisualizer.animateFiberTip(conn_id, fiber_number);
                                    }
	                			});
	                		}
	                	});
	                	//--------------------------------------------------------------------------
	                	//--------------------------------------------------------------------------
                        // Draw the tip of the fiber leaving the slot
                        // This should only be done if there's no host port connected to this fiber number
                        if (!self.isConnectedToAnyHost(conn_id, fiber_number) && $rootScope.Connections.originalApShow){
                            self.drawFiberTip(fiber_number, ap_id, conn_id, response);
                        }
	                	
	                	var end = new Date().getTime();
	                	var time = end - start;

	                	$rootScope.$apply();

                        self.isFusionsInLoading(response);

	                	//console.log("BACKEND SLOT TIME" + fiber_number + " of " + conn_id + " was " + ((time)/1000).toFixed(2));
	                }
	            });

                self.storeLoadRequest(ap_id, requestObject);
        	}
        },

        /**
         * Cancel all pending requests for an access point
         * @param {} apId 
         * @returns 
         */
        cancelApRequests : function(apId) {
            //console.log("cancelApRequests:", apId);
            // Return if no request is found
            if (!self.apLoadRequests[apId]){
                return;
            }

            // Abort all request that haven't finished (readyState 4)
            self.apLoadRequests[apId].forEach(request => {
                if (request.readyState != 4){
                    //console.log("ABORTING!");
                    request.abort();
                }
            });

            // Remove array entry for this access point
            self.apLoadRequests[apId] = [];
            self.apLoadRequests.splice(apId, 1);
        },

        // Store request in array for the given access point
        storeLoadRequest : function(apId, requestObject){
            if (!self.apLoadRequests[apId]){
                self.apLoadRequests[apId] = [];
            }
            self.apLoadRequests[apId].push(requestObject);
            //console.log("stored", self.apLoadRequests[apId]);
        },

        /**
         * Determine if a specific slot of a connection is connected to any host port
         * 
         * @param connection_id
         * @param slot_number
         * @returns boolean true if connected to host
         */
        isConnectedToAnyHost : function(connection_id, slot_number){
            // Check if any host port is connected to this slot
            for (var i = 0; i < $rootScope.Connections.hosts.length; i++){
                for (var k = 0; k < $rootScope.Connections.hosts[i].ports.length; k++){
                    if ($rootScope.Connections.hosts[i].ports[k].connection_id == connection_id
                        && $rootScope.Connections.hosts[i].ports[k].fiber == slot_number){
                            return true;
                        }
                }
            }
            return false;
        },
        
        setReportSlot : function(index){
        	var start = new Date().getTime();
        	var report_data = $rootScope.Connections.savedReportsSlots[index]['report_data'];
        	var conn_id = $rootScope.Connections.savedReportsSlots[index]['conn_id'];
        	var fiber_number = $rootScope.Connections.savedReportsSlots[index]['fiber_number'];
        	//--------------------------------------------------------------------------
        	// Check all connections on the left and on the right.
        	// if the connection matches with the one this fusion is connected to,
        	// add the report to the correct slot.
        	//--------------------------------------------------------------------------
        	angular.forEach($rootScope.Connections.connections['connectionsLeft'], function(connection, index_conn){
        		if (connection.id == conn_id){
        			angular.forEach(connection.slots, function(slot, index_slot){
        				if (slot.fiber == fiber_number){
        					$rootScope.Connections.connections['connectionsLeft'][index_conn].slots[index_slot].report_data = report_data;
        				}
        			});
        		}
        	});
        	angular.forEach($rootScope.Connections.connections['connectionsRight'], function(connection, index_conn){
        		if (connection.id == conn_id){
        			angular.forEach(connection.slots, function(slot, index_slot){
        				if (slot.fiber == fiber_number){
        					$rootScope.Connections.connections['connectionsRight'][index_conn].slots[index_slot].report_data = report_data;
        				}
        			});
        		}
        	});
        	//--------------------------------------------------------------------------
        	// Draw the tip of the fiber leaving the slot
            if($rootScope.Connections.originalApShow){
        	    self.drawFiberTip(fiber_number, null, conn_id, report_data);
            }
        	var end = new Date().getTime();
        	var time = end - start;

			self.isLoading = false;
			
        	$rootScope.$apply();
        	//console.log("FRONTEND SLOT TIME " + fiber_number + " of " + conn_id + " was " + ((time)/1000).toFixed(2));
        },
        
        reportAvailable : function(fusion){
        	if (itemInArray(fusion.id, $rootScope.Connections.reloadReportsFusions)){
        		var idx = $rootScope.Connections.reloadReportsFusions.indexOf(fusion.id);
        		$rootScope.Connections.reloadReportsFusions.splice(idx, 1);
        		//console.log("Fusao "+fusion.id+" precisava ser recarregada.");
        		//console.log($rootScope.Connections.reloadReportsFusions);
        		return -1;
        	}
        	var i;
        	for (i = 0; i < $rootScope.Connections.savedReportsFusions.length; i++){
                if ($rootScope.Connections.savedReportsFusions[i]['fusion'].id == fusion.id){
        			return i;
        		}
        	}
        	return -1;
        },
        
        saveReportSlot : function(fiber_number, conn_id, report){
        	//Delete all other reports regarding this route
        	var i;
        	for (i = 0; i < $rootScope.Connections.savedReportsSlots.length; i++){
        		if (($rootScope.Connections.savedReportsSlots[i]['fiber_number'] == fiber_number) && ($rootScope.Connections.savedReportsSlots[i]['conn_id'] == conn_id)){
        			$rootScope.Connections.savedReportsSlots.splice(i);
        		}
        	}
        	
        	//Save Report for further use
        	var slot_report = [];
        	slot_report['fiber_number'] = fiber_number;
        	slot_report['conn_id'] = conn_id;
        	slot_report['report_data'] = report;
			$rootScope.Connections.savedReportsSlots.push(slot_report);
        },
        
        saveReportFusion : function(response){
        	//Delete all other reports
        	var i;
        	for (i = 0; i < $rootScope.Connections.savedReportsFusions.length; i++){
        		if ($rootScope.Connections.savedReportsFusions[i]['fusion'].id == response.fusion.id){
        			$rootScope.Connections.savedReportsFusions.splice(i);
        		}
        	}
        	
			//Save report for further use
        	var fusion_report = [];
        	fusion_report['fusion'] = response.fusion;
        	fusion_report['report_in'] = response.report_in;
        	fusion_report['report_out'] = response.report_out;   
			$rootScope.Connections.savedReportsFusions.push(fusion_report);
        },
        
        /**
         * Update fusion method
         * gets the full report (in both directions) for the fusion, and updates
         * the corresponding slot in the view, in order to show the report
         * Also, it redraws the SVG line that represents the fusion in the Access Point
         * */
        updateFusion : function(fusion,sharedDatabase){
        	//Check if report is already saved. If so, no need for all the ajax waiting!
        	//TODO also check if this report is outdated.
        	if (!self.reloadRoutes){
        		index = self.reportAvailable(fusion)
        	} else {
        		index = -1;
        	}
        	if (index != -1){
        		self.setReport(index);
        	} else {
        		//If the report is not already available, get it!
	        	var start = new Date().getTime();
	        	let requestObject = $.ajax({
	                url: $rootScope.base_url+'/access_points/complete_fusion_report',
	                type: 'POST',
	                data: {fusion:fusion,sharedDatabase:sharedDatabase},
	                success:function(response){
	                	var enda = new Date().getTime();
	                	var timea = enda - start;
	                	//Save the report for efficiency (and delete all previous reports that might be there)
						self.saveReportFusion(response);
	                	//--------------------------------------------------------------------------
	                	// Check all connections on the left and on the right.
	                	// if the connection matches with the one this fusion is connected to,
	                	// add the report to the correct slot.
	                	//--------------------------------------------------------------------------
	                	angular.forEach($rootScope.Connections.connections['connectionsLeft'], function(connection, index_conn){
	                		if (connection.id == response.fusion.access_point_connection_id_in){
	                			angular.forEach(connection.slots, function(slot, index_slot){
	                				if (slot.fiber == response.fusion.fiber_in){
	                					$rootScope.Connections.connections['connectionsLeft'][index_conn].slots[index_slot].report_data = response.report_in;
	                				}
	                			})
	                		} 
	                		if (connection.id == response.fusion.access_point_connection_id_out){
	                			angular.forEach(connection.slots, function(slot, index_slot){
	                				if (slot.fiber == response.fusion.fiber_out){
	                					$rootScope.Connections.connections['connectionsLeft'][index_conn].slots[index_slot].report_data = response.report_out;
									}
	                			})
	                		} 
	                	});
	                	angular.forEach($rootScope.Connections.connections['connectionsRight'], function(connection, index_conn){
	                		if (connection.id == response.fusion.access_point_connection_id_in){
	                			angular.forEach(connection.slots, function(slot, index_slot){
	                				if (slot.fiber == response.fusion.fiber_in){
	                					$rootScope.Connections.connections['connectionsRight'][index_conn].slots[index_slot].report_data = response.report_in;
									}
	                			})
	                		} 
	                		if (connection.id == response.fusion.access_point_connection_id_out){
	                			angular.forEach(connection.slots, function(slot, index_slot){
	                				if (slot.fiber == response.fusion.fiber_out){
	                					$rootScope.Connections.connections['connectionsRight'][index_conn].slots[index_slot].report_data = response.report_out;
									}
	                			})
	                		} 
	                	});
	                	//-----------------------------------------------------------
	                	//-----------------------------------------------------------
	                	//if (response.fusion.active){
	                		//Redraw svg line
	                		conns = [];
	                		conns['fusions'] = [];
	                		conns['fusions'].push(response.fusion);
	                		self.drawFusions(conns);
	                	//}
	                	var end = new Date().getTime();
	                	var time = end - start;

                        self.isFusionsInLoading(response.fusion.id);

	                	$rootScope.$apply();
	                	//console.log("BACKEND FUSION TIME " + response.fusion.id + " was " + ((time)/1000).toFixed(2)  );
	                }
	            });

                if (fusion.access_point_connection_in) {
                    self.storeLoadRequest(fusion.access_point_connection_in.access_point_id, requestObject);
                } else if (fusion.access_point_connection_out) {
                    self.storeLoadRequest(fusion.access_point_connection_out.access_point_id, requestObject);
                }
        	}
        },

        /*
        *
        * Verifica se existe alguma fusão para ser carregada e 
        * se não houver seta isLoading = false para aparecer o botão Novo Layout
        * 
        */
        isFusionsInLoading : function(fusion_id){

            // Encontre o índice do item a ser removido
            var index_fusion = self.fusionsInLoading.findIndex(fusion => fusion.id === parseInt(fusion_id));

            // Se o índice for válido, remova o item
            if (index_fusion !== -1) {
                self.fusionsInLoading.splice(index_fusion, 1);
            }

            if(index_fusion === -1 || jQuery.isEmptyObject(self.fusionsInLoading)){
                self.isLoading = false;
                $rootScope.Connections.apVisualizerLoadingFiberReports = false;
            }

        },
        
        setReport : function(index){
        	var start = new Date().getTime();
        	var fusion_report = $rootScope.Connections.savedReportsFusions[index];
        	var fusion = fusion_report['fusion'];
        	//--------------------------------------------------------------------------
        	// Check all connections on the left and on the right.
        	// if the connection matches with the one this fusion is connected to,
        	// add the report to the correct slot.
        	//--------------------------------------------------------------------------
        	angular.forEach($rootScope.Connections.connections['connectionsLeft'], function(connection, index_conn){
        		if (connection.id == fusion.access_point_connection_id_in){
        			angular.forEach(connection.slots, function(slot, index_slot){
        				if (slot.fiber == fusion.fiber_in){
        					$rootScope.Connections.connections['connectionsLeft'][index_conn].slots[index_slot].report_data = fusion_report['report_in'];
        				}
        			})
        		} 
        		if (connection.id == fusion.access_point_connection_id_out){
        			angular.forEach(connection.slots, function(slot, index_slot){
        				if (slot.fiber == fusion.fiber_out){
        					$rootScope.Connections.connections['connectionsLeft'][index_conn].slots[index_slot].report_data = fusion_report['report_out'];
        				}
        			})
        		} 
        	});
        	angular.forEach($rootScope.Connections.connections['connectionsRight'], function(connection, index_conn){
        		if (connection.id == fusion.access_point_connection_id_in){
        			angular.forEach(connection.slots, function(slot, index_slot){
        				if (slot.fiber == fusion.fiber_in){
        					$rootScope.Connections.connections['connectionsRight'][index_conn].slots[index_slot].report_data = fusion_report['report_in'];
        				}
        			})
        		} 
        		if (connection.id == fusion.access_point_connection_id_out){
        			angular.forEach(connection.slots, function(slot, index_slot){
        				if (slot.fiber == fusion.fiber_out){
        					$rootScope.Connections.connections['connectionsRight'][index_conn].slots[index_slot].report_data = fusion_report['report_out'];
        				}
        			})
        		} 
        	});
        	//-----------------------------------------------------------
        	if (fusion.active){
        		//Redraw svg line
        		conns = [];
        		conns['fusions'] = [];
        		conns['fusions'].push(fusion);
        		self.drawFusions(conns);
        	}
        	
        	$rootScope.$apply();
        	var end = new Date().getTime();
        	var time = end - start;
        	//console.log("FRONTEND FUSION TIME " + fusion.id + " was " + ((time)/1000).toFixed(2));
        },
        
        /*
         * Slot Free method
         * given the number of the slot, the connection, and all the fusions in the Acccess Point,
         * this method checks if there is any of the fusions connected to this slot.
         * Also checks if any host port connects to the slot
         * If nothing is connected to the slot, TRUE is returned. False is returned otherwise.
         * */
        slotFree : function(slot_number, connection_id, fusions){
            // Check if any fusion is connected to this slot
        	for (j = 0; j < fusions.length; j++){
        		if (fusions[j].access_point_connection_id_in == connection_id){
        			if (fusions[j].fiber_in == slot_number){
        				self.slotNotFreeFusion = fusions[j];
        				return false;
        			}
        		} else if (fusions[j].access_point_connection_id_out == connection_id){
        			if (fusions[j].fiber_out == slot_number){
        				self.slotNotFreeFusion = fusions[j];
        				return false;
        			}
        		}
            }

    		return true;
        },
        
        findConnection : function(id){ 
            resp = false;
            angular.forEach($rootScope.Connections.connections.connectionsLeft, function(el,index){
                if(el.id == id){
                    resp =  el;
                }
            });
            angular.forEach($rootScope.Connections.connections.connectionsRight, function(el,index){
                if(el.id == id){
                    resp =  el;
                }
            });
            angular.forEach($rootScope.Connections.client_connections, function(el,index){
                if(el.id == id){
                    resp =  el;
                }
            });
            return resp;
        },


        findHost : function(id){ 
            resp = false;
            angular.forEach($rootScope.Connections.hosts, function(el,index){
                if(el.id == id){
                    resp =  el;
                }
            });
            return resp;
        },

        attachReport : function(slot, report){
       
            fusion = false;
            var d = $q.defer();
            id_fusion = false;

            if(slot.id_html){
               id = slot.id_html; 
            }else{
               id = slot.id;               
               
            }
            data = id.split('_');
            
            conn_id =  data[0];
            fiber  = data[1];
            
            //rodar todas as fusions e encotrar a qual tem a fibra x e a connection x para pedar o id da fusion
            angular.forEach($rootScope.Connections.connections.connectionsLeft, function(conn,indexConn){
                if(conn){
                    if(conn.id == conn_id){
                        angular.forEach(conn.slots, function(slotConn, indexSlot){
                            if(slotConn.id == id){
                                $rootScope.Connections.connections.connectionsLeft[indexConn].slots[indexSlot]['reportLog'] = report;
                                d.resolve();
                            }
                        })
                    }
                }
            });    
            angular.forEach($rootScope.Connections.connections.connectionsRight, function(conn,indexConn){
                if(conn){
                    if(conn.id == conn_id){
                        angular.forEach(conn.slots, function(slotConn, indexSlot){
                            if(slotConn.id == id){
                                $rootScope.Connections.connections.connectionsRight[indexConn].slots[indexSlot]['reportLog'] = report;
                                d.resolve();
                            }
                        })
                    }
                }
            });    
           
            return d.promise;   
        },

        attachLastItemReport : function(slot, last_item){
            
            fusion = false;
            var d = $q.defer();
            id_fusion = false;

            if(slot.id_html){
               id = slot.id_html; 
            }else{
               id = slot.id;               
            }
            data = id.split('_');
            
            conn_id =  data[0];
            fiber  = data[1];
            
            //rodar todas as fusions e encotrar a qual tem a fibra x e a connection x para pedar o id da fusion
            angular.forEach($rootScope.Connections.connections.connectionsLeft, function(conn,indexConn){
                if(conn){
                    if(conn.id == conn_id){
                        angular.forEach(conn.slots, function(slotConn, indexSlot){
                            if(slotConn.id == id){
                                $rootScope.Connections.connections.connectionsLeft[indexConn].slots[indexSlot]['last_item'] = last_item;
                                $rootScope.Connections.connections.connectionsLeft[indexConn].slots[indexSlot]['last_item_report'] = 1;
                                d.resolve();
                            }
                        })
                    }
                }
            });    
            angular.forEach($rootScope.Connections.connections.connectionsRight, function(conn,indexConn){
                if(conn){
                    if(conn.id == conn_id){
                        angular.forEach(conn.slots, function(slotConn, indexSlot){
                            if(slotConn.id == id){
                                $rootScope.Connections.connections.connectionsRight[indexConn].slots[indexSlot]['last_item'] = last_item;
                                $rootScope.Connections.connections.connectionsRight[indexConn].slots[indexSlot]['last_item_report'] = 1;
                                d.resolve();
                            }
                        })
                    }
                }
            });    
           
            return d.promise;  
        },

        closeLastItemReport : function(slot){
            fusion = false;
            var d = $q.defer();
            id_fusion = false;

            if(slot.id_html){
               id = slot.id_html; 
            }else{
               id = slot.id;               
               
            }
            data = id.split('_');
            
            conn_id =  data[0];
            fiber  = data[1];
            
            //rodar todas as fusions e encotrar a qual tem a fibra x e a connection x para pedar o id da fusion
            angular.forEach($rootScope.Connections.connections.connectionsLeft, function(conn,indexConn){
                if(conn){
                    if(conn.id == conn_id){
                        angular.forEach(conn.slots, function(slotConn, indexSlot){
                            if(slotConn.id == id){
                                $rootScope.Connections.connections.connectionsLeft[indexConn].slots[indexSlot]['last_item_report'] = 0;
                                d.resolve();
                            }
                        })
                    }
                }
            });    
            angular.forEach($rootScope.Connections.connections.connectionsRight, function(conn,indexConn){
                if(conn){
                    if(conn.id == conn_id){
                        angular.forEach(conn.slots, function(slotConn, indexSlot){
                            if(slotConn.id == id){
                                $rootScope.Connections.connections.connectionsRight[indexConn].slots[indexSlot]['last_item_report'] = 0;
                                d.resolve();
                            }
                        })
                    }
                }
            });    
           
            return d.promise;        
        },
        
        checkSlotReport : function(slot,status){
            // 0 para parado
            // 1 para report log completo
            // 2 para aguardando report

            fusion = false;
            var d = $q.defer();
            id_fusion = false;

            if(slot.id_html){
               id = slot.id_html; 
            }else{
               id = slot.id;               
               
            }
            data = id.split('_');
            
            conn_id =  data[0];
            fiber  = data[1];
            
            //rodar todas as fusions e encotrar a qual tem a fibra x e a connection x para pedar o id da fusion
            angular.forEach($rootScope.Connections.connections.connectionsLeft, function(conn,indexConn){
                if(conn){
                    if(conn.id == conn_id){
                        angular.forEach(conn.slots, function(slotConn, indexSlot){
                            if(slotConn.id == id){
                                $rootScope.Connections.connections.connectionsLeft[indexConn].slots[indexSlot]['report'] = status;
                                d.resolve();
                            }
                        })
                    }
                }
            });    
            angular.forEach($rootScope.Connections.connections.connectionsRight, function(conn,indexConn){
                if(conn){
                    if(conn.id == conn_id){
                        angular.forEach(conn.slots, function(slotConn, indexSlot){
                            if(slotConn.id == id){
                                $rootScope.Connections.connections.connectionsRight[indexConn].slots[indexSlot]['report'] = status;
                                d.resolve();
                            }
                        })
                    }
                }
            });    
           
            return d.promise;        
        },

        /**
         * Check Slot
         * 
         * Funcionalidade:
         * 
         *  - nos dados da caixa aberta, localiza o slot e nele atualiza dados de conexão:
         *     - connected: 0 para não conectado, 1 para conectado
         *     - connection_type: pode ser 0 - não sei significado no momento
         *      (Faz isso para conexões de cabos da esquerda e direita, conexões de clientes, e equipamentos)
         * 
         *  - Para clientes, ainda faz deploy se foi conectado, undeploy se foi desconectado;
         * 
         * @param {*} slot // dados do slot a ser atualizado
         * @param {*} status // status da conexão: 1 conectado, 0 desconectado
         * @param {*} connection_type // 1 para fusão, 0 para passagem
         * @returns assynchronous void
         */
        checkSlot : function(slot,status,connection_type){
            fusion = false;
            var d = $q.defer();
            id_fusion = false;

            if(slot.id_html){
               id = slot.id_html; 
            }else{
               id = slot.id;
            }
            if (slot.client){
            	conn_id = 0;
            	fiber = 0;
            	id = slot.id;
            	got_client_id = false;
            } else {
	            data = id.split('_');
	            conn_id =  data[0];
	            fiber  = data[1];
	            got_client_id = true;
            }
            
            //rodar todas as fusions e encotrar a qual tem a fibra x e a connection x para pedar o id da fusion
            angular.forEach($rootScope.Connections.connections.connectionsLeft, function(conn,indexConn){
                if(conn){
                    if(conn.id == conn_id){
                        angular.forEach(conn.slots, function(slotConn, indexSlot){
                            if(slotConn.id == id){
                                $rootScope.Connections.connections.connectionsLeft[indexConn].slots[indexSlot]['connected'] = status;
                                $rootScope.Connections.connections.connectionsLeft[indexConn].slots[indexSlot]['connection_type'] = connection_type;
                                d.resolve();
                            }
                        })
                    }
                }
            });    
            angular.forEach($rootScope.Connections.connections.connectionsRight, function(conn,indexConn){
                if(conn){
                    if(conn.id == conn_id){
                        angular.forEach(conn.slots, function(slotConn, indexSlot){
                            if(slotConn.id == id){
                                $rootScope.Connections.connections.connectionsRight[indexConn].slots[indexSlot]['connected'] = status;
                                $rootScope.Connections.connections.connectionsRight[indexConn].slots[indexSlot]['connection_type'] = connection_type;
                                d.resolve();
                            }
                        })
                    }
                }
            });    
           
            // verificar tambem as portas dos equips 
            angular.forEach($rootScope.Connections.hosts, function(host,indexHost){
                angular.forEach(host.ports, function(port,indexPorts){
                    if(port.id_html == id){
                        $rootScope.Connections.hosts[indexHost].ports[indexPorts]['connected'] = status;
                        $rootScope.Connections.hosts[indexHost].ports[indexPorts]['connection_type'] = connection_type;
                        d.resolve();                        
                    }
                });
            });
            
            //Verificar conexoes de clientes
            angular.forEach($rootScope.Connections.client_connections, function(client_conn,index_conn){
                if((!got_client_id && (client_conn.id == id)) || (got_client_id && (conn_id == client_conn.id))){
                    $rootScope.Connections.client_connections[index_conn].connected = status;
                    $rootScope.Connections.client_connections[index_conn].connection_type = connection_type;
                    if (status == 1){
                    	$rootScope.Clients.deploy(client_conn.client.id, 1);
                    } else if (status == 0){
                    	$rootScope.Clients.deploy(client_conn.client.id, 0);
                    }
                    d.resolve();                        
                }
            });

            return d.promise;        
        },

        findSlotFusion : function(slot){
            fusion = false;
            var d = $q.defer();
            id_fusion = false;
            data = slot.id.split('_');
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
            //verificar tambem as portas dos equips 
            angular.forEach($rootScope.Connections.hosts, function(host,index){
                angular.forEach(host.ports, function(port,index){
                    if((port.fiber == slot.fiber && port.connection_id == slot.connection_id)){
                        d.resolve(port);   
                    }
                });
            });       

            return d.promise;          
        },

        findSlotFusionSync : function(slot){
            return_fusion = null;
            id_fusion = false;
            if (slot.client){
            	conn_id = slot.id;
            	fiber = slot.fiber;
            } else {
	            data = slot.id.split('_');
	            conn_id =  data[0];
	            fiber  = data[1];
            }
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
                    	return_fusion = fusion;
                    }
                }
            });    
            //verificar tambem as portas dos equips 
            angular.forEach($rootScope.Connections.hosts, function(host,index){
                angular.forEach(host.ports, function(port,index){
                    if((port.fiber == slot.fiber && port.connection_id == slot.connection_id)){
                    	return_fusion = port;   
                    }
                });
            });
            return return_fusion;  
        },

	}

    // self.codeColor[0] = ["grey"];
    // self.codeColor[1] = ["null","blue","orange","green","brown","gray","white","red","black","yellow","violet","pink","aquamarine"];
    // self.codeColor[2] = ["null","green","yellow","white","blue","red","violet","brown","pink","black","gray","orange","aquamarine"];
    // self.codeColor[3] = ["null","blue","green","red","yellow","white","white","white","white","white","white","white","white"];
    // self.codeColor[4] = ["null","blue","green","red","yellow","orange","brown","gray","violet","white","white","white","white"];
    // self.codeColor[5] = ["null","green","red","blue","yellow","gray","violet","brown","orange"];
    // self.codeColor[6] = ["null","green","yellow","white","blue","red","violet","brown","pink","black","gray","orange","aquamarine"];
    // self.codeColor[7] = ["null","green","red","blue","yellow","gray","violet","brown","orange"];
    // self.codeColor[8] = ["null","blue","orange","green","brown","gray","white","red","black","yellow","violet","pink","aquamarine"];
    // self.codeColor[9] = ["null","green","red","blue","yellow","gray","violet","brown","orange"];
    // self.codeColor[10] = ["null","green","red","blue","yellow","gray","violet","brown","orange"];
    // self.codeColor[11] = ["null","green","red","blue","yellow","gray","violet","brown","orange"];
    // self.codeColor[12] = ["null","green","red","blue","yellow","gray","violet","brown","orange"];
    // self.codeColor[13] = ["null","red","green","blue","yellow","gray","white","orange","brown","#00ffff","violet","black","pink"];


	return self;

})


