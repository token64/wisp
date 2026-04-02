

app.service("Reserves", function(Map, $rootScope,Projects,dialogService,$timeout,Cables,LevelsAndModes){
	
	var self = {
		isLoading : false,
		reserves : [],
		viewAllReserves : true,
		editing : false,
		adding: false,
		visualizing : false,
		reserveAdded : false,

		updateItemsMenu : function(){
			self.reservesItemMenu = [];
			angular.forEach(self.reserves, function(reserve,indexReserve){
				if (itemInArray(reserve.project, $rootScope.Projects.projectsChecked)){
					self.reservesItemMenu.push(reserve);
				}
			});
		},
		
		changeProject : function(id, project_id){
			link = $rootScope.base_url+"/cable_reserves/change_project";
			dataSend = {};
			dataSend.id = id;
			dataSend.project_id = project_id;
			$.ajax({
      			url: link,
      			type: "POST",
      			data: dataSend,
      			success:function(data){
      				$.ajax({
      					url: $rootScope.base_url+"/cable_reserves/get",
      					type: "POST",
      					data: {id:id},
      					success:function(data){       
      						angular.forEach(self.reserves,function(val,index){
      							if (val.id == id){
      								self.reserves[index].project = data.dot.projects[0]["id"];
      								self.reserves[index].project_name = data.dot.projects[0]["name"];
      								$rootScope.$apply();
      							}
      						});            
      					}
      				});
      			}
      		});
		},
		
		deploy : function(reserve){
			self.selectedReserve = reserve;
			if(reserve.deploy_information.deployed){
				deploy = 0;
			}else{
				deploy = 1;
			}
			self.isLoading = true;
			$.ajax({
				url: $rootScope.base_url+"/cable_reserves/deploy",
				type: "POST",
				data: {id:reserve.id,deployed:deploy},
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

						$rootScope.Markers.removeFromMap(self.selectedReserve.dot);

						created_entity = data.data;
						var dot_id  = created_entity.dot.id;
						var reserve = created_entity;

						reserve.dot = Map.drawSVGMarker(created_entity.dot.lat, created_entity.dot.lng, "reserva", created_entity.name,
						"reserva", created_entity.deploy_information.deployed, self.getColor(created_entity), "black");

						reserve.dot.id = dot_id;
						if(!deploy && (LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_TECNICO]) || 
							LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR]))){
							reserve.dot.setDraggable(true);	
						} else {
							reserve.dot.setDraggable(false);
						}
						reserve.deploy_information = created_entity.deploy_information;
						Map.addListenerReserve(reserve);
						//reserve.dot.setMap(Map.map);
						$rootScope.Markers.addToMap(reserve.dot);
					}            
				},
				complete:function(){
					self.isLoading = false;
					if($rootScope.dialogService.isOpen("menuReserve")){
						$rootScope.dialogService.close("menuReserve");
					}  
					$rootScope.$digest();
				}
			});
		},



		edit: function(reserve){
			self.selectedReserve = reserve;
			var options = {
				autoOpen: false,
				modal: true,
				title: $rootScope.Users.translateText("Editar reserva"),
				width: 300,
				height:"auto",
				resizable:true,
				dialogClass: "noclose", 
			};
			model = [];  
			self.editing = true;
			$rootScope.form = reserve;
			$rootScope.form.error = [];
			$rootScope.dialogService.open("reserveAdd","reserveAdd", model, options).then();
		},

		viewAll : function(){
			if(self.viewAllReserves){
				angular.forEach(self.reserves,function(val,index){
					if(val.dot.map){
							$rootScope.Markers.removeFromMap(val.dot);
							val.statusView = false;
					}	
				});            
				self.viewAllReserves = 0;      
			}else{
				angular.forEach(self.reserves,function(val,index){
					if(!val.dot.map){						
						if(Cables.cableIsOnMap(val.cable_id)){
							$rootScope.Markers.addToMap(val.dot);
							val.statusView = true;
						}
					}
				});               
				self.viewAllReserves = 1;   
			} 
		},

		focus : function(index){
			self.reservesItemMenu[index].dot.setMap(Map.map);
			self.reservesItemMenu[index].statusView = 1;
			Map.setCenter(self.reservesItemMenu[index].dot.getPosition().lat(),self.reservesItemMenu[index].dot.getPosition().lng(),15);
		},
		
		view : function(index){
			if(self.reservesItemMenu[index].dot.getMap()){
				self.reservesItemMenu[index].dot.setMap(null);
				self.reservesItemMenu[index].statusView = 0;
			}else{
				self.reservesItemMenu[index].dot.setMap(Map.map);
				self.reservesItemMenu[index].statusView = 1;
				Map.setCenter(self.reservesItemMenu[index].dot.getPosition().lat(),self.reservesItemMenu[index].dot.getPosition().lng(),15);
			}
		},

		delete : function(reserve){

			self.selectedReserve = reserve;
			var options = {
				autoOpen: false,
				modal: true,
				title: $rootScope.Users.translateText("Remover reserva"),
				width: 300,
				height:"auto",
				resizable:true,
				dialogClass: "noclose", 
			};
			model = [];  
			self.adding = true;
			$rootScope.form = reserve;
			$rootScope.form.error = [];
			$rootScope.dialogService.open("reserveDelete","reserveDelete", model, options).then();
		},

		deleteConfirm : function(){
			link = $rootScope.base_url+"/cable_reserves/delete";
			$.ajax({
				url: link,
				type: "POST",
				data: {id:self.selectedReserve.id},
				success:function(data){
					$rootScope.set_errors_modal(data,"reserveDelete");
					self.selectedReserve = false;
					if(data.status == 1){
						self.list(true);
						if($rootScope.dialogService.isOpen("menuReserve")){
							$rootScope.dialogService.close("menuReserve");
						} 
					}
				},
				complete:function(){
					$rootScope.$apply();
				}
			});  
		},

		addCancel:function(){
			$rootScope.form = [];
			self.adding = false;
			self.editing = false;
			self.visualizing = false;
			$rootScope.dialogService.close("reserveAdd");
		},


		list : function(flag){

			self.isLoading = true;
			link = $rootScope.base_url+"/cable_reserves/list_all";
			$.ajax({
				url: link,
				type: "POST",
				success:function(data){
					// console.log(data);
					if(angular.isDefined(self.reserves)){
						angular.forEach(self.reserves,function(val,index){
							//val.dot.setMap(null);
							$rootScope.Markers.removeFromMap(val.dot);
						});	
					}		
					reserves = [];
					self.reserves = self.reserves ? self.reserves : [];	

					if(data.length > 0){
						angular.forEach(data,function(val,index){
							if(val.dot){
								dot_id  = val.dot.id;
								reserve = val;

								reserve.dot = Map.drawSVGMarker(reserve.dot.lat, reserve.dot.lng, "reserva", reserve.name,
                                "reserva", reserve.deploy_information.deployed, self.getColor(reserve), "black");

								reserve.dot.id = dot_id;
								if((LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_TECNICO]) || 
				LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR]))
								&& ((!reserve.deploy_information.deployed))){
									reserve.dot.setDraggable(true);	
								} else {
									reserve.dot.setDraggable(false);
								}
								reserve.deploy_information  = val.deploy_information;

								Map.addListenerReserve(reserve);
								if(flag){
									//reserve.dot.setMap(Map.map);
									$rootScope.Markers.addToMap(reserve.dot);
									self.viewReserves = true;
								};
								
								reserves.push(reserve);
							} else {
								console.warn("Reserve error", val);
							}
						});

					}
					self.isLoading = false;

					self.reserves = reserves;
					// console.log(self.reserves);
				},
				complete:function(){
					$rootScope.$apply();
				}
			});  
		},


		organize_reserve_data : function(data){
						
			self.reserves = self.reserves ? self.reserves : [];					
			if(data.length > 0){
				angular.forEach(data,function(val,index){
					if(val.dot){
						dot_id  = val.dot.id;
						reserve = val;

						reserve.dot = Map.drawSVGMarker(reserve.dot.lat, reserve.dot.lng, "reserva", reserve.name,
                                "reserva", reserve.deploy_information.deployed, self.getColor(reserve), "black");

						reserve.dot.id = dot_id;
						reserve.dot.setDraggable(false);
						reserve.deploy_information  = val.deploy_information;

						Map.addListenerReserve(reserve);
						
						reserves.push(reserve);
					}else{
						console.log('Reserva sem ponto nao foi desenhada');
					}
				});

			}
			self.isLoading = false;

			self.reserves = reserves;
			// console.log(self.reserves);
		},


		add : function(){
			Cables.usingPositionOnCable = true;
			var options = {
				autoOpen: false,
				modal: true,
				title: $rootScope.Users.translateText("Adicionar reserva"),
				width: 300,
				height:"auto",
				resizable:true,
				dialogClass: "noclose", 
			};
			model = [];  
			self.adding = true;
			$rootScope.form = [];
			$rootScope.form.error = [];
			$rootScope.dialogService.close("menuCable");
			$rootScope.dialogService.open("reserveAdd","reserveAdd", model, options).then();
		},


		addConfirm : function(){
			created_entity = null;
			$rootScope.form.error = [];	
			self.isLoading = true;

			data = {};
			data.length = $rootScope.form.length;

			data.color = $rootScope.form.color; 

			if(self.editing){
				link = $rootScope.base_url+"/cable_reserves/edit";  
				data.id = $rootScope.form.id;
			}else{
				link = $rootScope.base_url+"/cable_reserves/add_on_cable";  
				data.dot = {};
				data.cable = {};
				
				data.project = parseInt(Projects.projectSelected);  
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
					data.prev_dot = Cables.positionOnCable.prevDot.id;
					data.position = 2;
				}
			}
			Cables.usingPositionOnCable = false;
			Cables.positionOnCable = false;
			$.ajax({
				url: link,
				type: "POST",
				data: data,
				success:function(data){
					$rootScope.set_errors_modal(data,"reserveAdd");
					self.visualizing = false;
					self.isLoading = false;
					if(data.status == 1){
						created_entity = data.data;
						if($rootScope.dialogService.isOpen("menuReserve")){
							$rootScope.dialogService.close("menuReserve");
						}    
						var dot_id  = created_entity.dot.id;
						var reserve = created_entity;

						reserve.dot = Map.drawSVGMarker(created_entity.dot.lat, created_entity.dot.lng, "reserva", created_entity.name,
						"reserva", created_entity.deploy_information.deployed, self.getColor(created_entity), "black");

						reserve.dot.id = dot_id;
						if(LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_TECNICO]) || 
		LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR])){
							reserve.dot.setDraggable(true);	
						} else {
							reserve.dot.setDraggable(false);
						}
						reserve.deploy_information = created_entity.deploy_information;
						Map.addListenerReserve(reserve);
						//reserve.dot.setMap(Map.map);
						$rootScope.Markers.addToMap(reserve.dot);
						self.reserves.push(reserve);
						self.reserveAdded = true;
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
					Cables.redrawCable(Cables.cableSelected.id,false);
					$rootScope.$apply();
				}
			});  
		},

		getColor: function (reserva) {
			if (!reserva.color) {
				// If no color is set, set default grey
				reserva.color = "#c0c0c0";
			}
			return reserva.color;
		},

		setCableReservesMap : function(cable_id, map){
			setTimeout(function () {
				angular.forEach(self.reserves, function(reserve, reserve_index){
					if (reserve.cable_id == cable_id){
						if (map){
							$rootScope.Markers.addToMap(reserve.dot);
						} else {
							$rootScope.Markers.removeFromMap(reserve.dot);
						}
					}
				});
   		  	}, 10);
		}
	};

	return self;

});

