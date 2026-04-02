app.service('Regions', function(Map, $rootScope,Projects,dialogService,$timeout,LevelsAndModes){
	
	var self = {
		isLoading : false,
		regions : [],
		viewAllRegions : false,
		editing : false,
		adding: false,

		
		updateItemsMenu : function(){
			self.regionsItemMenu = [];
			angular.forEach(self.regions, function(region,indexRegion){
				if (itemInArray(region.project, $rootScope.Projects.projectsChecked)){
					self.regionsItemMenu.push(region);
				}
			})
		},
		
		redrawRegion : function(id){
			link = $rootScope.base_url+'/regions/get';
			$.ajax({
		          url: link,
		          data: {id:id},
		          type: 'POST',
		          success:function(data){
		        	  
		        	  angular.forEach(self.regions, function(rgn, indexRegion){
		        		  if (rgn.id == id){
		        			  angular.forEach(rgn.dots,function(dot,index){
		        				  dot.setMap(null);
		        			  });
		        			  rgn.shape.setMap(null);
		        			  
							  path = [];
							  dots = []
							  angular.forEach(data.dots,function(pto,index){                
							    path.push({lat:parseFloat(pto.lat),lng:parseFloat(pto.lng)});                              
							    dot = Map.drawMarker(pto.lat, pto.lng,'','marker.png',$rootScope.Users.translateText('Guia da região'),'',0);
							    dot.id = pto.id;
							    dot.regionId = data.id;
							    dot.index = index;
							    Map.addListenerDotRegion(dot);
							    dots.push(dot);
							  });
							
							  shape = Map.drawShape(path,data.color);  
							  region = [];
							  region.name = data.name;
							  region.color = data.color;
							  region.id = data.id;
							  region.dots = dots;
							  region.statusView = 0;
							  region.statusEdit = 0;
							  region.shape =  shape;
							  region.shape.setMap(Map.map);
							  Map.addListenerRegion(region);
							  self.regions[indexRegion] = region;
							  $rootScope.$apply();
		        		  }
		        	  })
		          },
		          complete:function(){
		          	// console.log(self);
		          }
		        }) 
		},
		
		list : function(){
			link = $rootScope.base_url+'/regions/list_all';
			
	        $.ajax({
	          url: link,
	          type: 'POST',
	          success:function(data){       

	            self.regions = [];
	            angular.forEach(data,function(val,index){
	              path = [];
	              dots = []
	              angular.forEach(val.dots,function(pto,index){                
	                path.push({lat:parseFloat(pto.lat),lng:parseFloat(pto.lng)});                              
	                dot = Map.drawMarker(pto.lat, pto.lng,'','marker.png',$rootScope.Users.translateText('Guia da região'),'',0);
	                dot.id = pto.id;
	                dot.regionId = val.id;
	                dot.index = index;
	                Map.addListenerDotRegion(dot);
	                dots.push(dot);
	              });

	              shape = Map.drawShape(path,val.color);  
	              region = [];
	              region.name = val.name;
	              region.color = val.color;
	              region.id = val.id;
	              region.dots = dots;
	              region.statusView = 0;
	              region.statusEdit = 0;
	              region.shape =  shape;
	              Map.addListenerRegion(region);
	              self.regions.push(region); 
	            });

	          },
	          complete:function(){
	          	// console.log(self);
	          }
	        }) 
		},

		delete : function(region){
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
			$rootScope.regionId = region.id;
			$rootScope.dialogService.close('menuRegion');
			dialogService.open('regionDelete','regionDelete', model, options).then();
		},

	

		deleteConfirm : function(id){
			self.isLoading = true;
			link = $rootScope.base_url+'/regions/delete';
			$.ajax({
				url: link,
				type: 'POST',
				data: {id:id},
				success:function(data){
					$rootScope.set_errors_modal(data,'regionDelete');
					if(data.status == 1){
						var i = 0;
						for (i = 0; i < self.regions.length; i++){
							if (self.regions[i].id == id){
								self.regions[i].shape.setMap(null);
								self.regions.splice(i,1);
							}
						}
					}
				},
				complete:function(){
					self.isLoading = false;
				}
			})  
		},

	

		edit : function(index){

			
			if(self.editing){
				$rootScope.message_error = $rootScope.Users.translateText('Termine ou cancele a edição do item atual para poder continuar');
				$timeout(function() {
					$rootScope.message_error = '';
				}, 3000);
				return;
			}


				if(!self.regionsItemMenu[index].statusEdit){          
		            //abrir modal de edição
		            self.regionsItemMenu[index].statusView = true;
		            self.regionsItemMenu[index].shape.setMap(Map.map);
		            var options = {
		            	autoOpen: false,
		            	modal: false,
		            	title: $rootScope.Users.translateText('Editar região'),
		            	width: 352,
		            	height:'auto',
		            	resizable:false,
		            	dialogClass: "noclose", 
		            	dialogClass: "noclose no-scroll", 
		            	position: {
		            		my: "left top",
		            		at: "left+10 top+80",
		            		of: window,
		            		collision: "none"
		            	},
		            	create: function (event, ui) {
		            		$(event.target).parent().css('position', 'fixed');
		            	},
		            	close:function(){
		            		$rootScope.message_error_modal  = false;
		            	}                
		            };
		            model = [];  

		            //deixar os marcadores da regioao editaveis
		            angular.forEach(self.regionsItemMenu[index].dots,function(dot,index){
		              //focar no primeiro ponto da regiao
		              if(index == 0){
		              	Map.setCenter(dot.getPosition().lat(),dot.getPosition().lng(),15);
		              }
		              dot.setMap(Map.map);
		              if(LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_TECNICO]) || 
                LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR])){
		            	  dot.setDraggable(true);
		              } else {
		            	  dot.setDraggable(false);
		              }
		            })

		            self.regionsItemMenu[index].statusEdit = true;
		            self.editing = true;
		            $rootScope.form = self.regionsItemMenu[index];
		            $rootScope.form.error = [];          
		            dialogService.open('regionAdd','regionAdd', model, options).then();
		        } 
		},

		add : function(){

				$rootScope.Cables.offEditCablePolyline();
				
				if(self.adding){
					self.adding = false;
					self.addCancel();
				}else{
					var options = {
						autoOpen: false,
						modal: false,
						title: $rootScope.Users.translateText('Adicionar Região'),
						width: 352,
						height:'auto',
						resizable:false,
						dialogClass: "noclose", 
						dialogClass: "noclose no-scroll", 
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
							$rootScope.menuMap = false;
							if($rootScope.dotsTemp.length > 0){
								angular.forEach($rootScope.dotsTemp,function(val,index){
									val.setMap(null);
								});
								$rootScope.shapeTemp.setMap(null);
							}
							$rootScope.tempPath = [];
							$rootScope.dotsTemp = [];
							$rootScope.shapeTemp = [];
							$rootScope.dotsCount = 0;
						}
					};
					model = [];  
					self.adding = true;
					$rootScope.dotsCount = 0;					
					$rootScope.form = [];
					$rootScope.form.error = [];          
					dialogService.open('regionAdd','regionAdd', model, options).then();
				}
		},


		


		addCancel : function(){
			if(self.editing){
				$rootScope.form.shape.setMap(null);
				angular.forEach( $rootScope.form.dots,function(dot,index){
					dot.setMap(null);
				})


				angular.forEach(self.regions,function(val,indexRegion){
					if(val.id == $rootScope.form.id){

						self.regions[indexRegion].statusEdit = false;

						self.regions[indexRegion].statusView = true;
						self.regions[indexRegion].shape.setMap(Map.map);
						angular.forEach(self.regions[indexRegion].dots,function(dot,index){
							dot.setMap(null);
						})
					    //deixar os marcadores da regioao editaveis          
					    self.regions[indexRegion].statusEdit = false;
					    self.editing = false;
					    $rootScope.form = [];
					    $rootScope.form.error = [];  
					    dialogService.close('regionAdd');
				    }
				    
				});
				
			}else{
				if($rootScope.dotsCount>0){
					angular.forEach($rootScope.dotsTemp,function(val,index){
						val.setMap(null);
					});
					$rootScope.shapeTemp.setMap(null);
				}
				$rootScope.tempPath = [];
				$rootScope.dotsTemp = [];
				$rootScope.shapeTemp = [];
				$rootScope.dotsCount = 0;
				$rootScope.form = [];
				$rootScope.form.error = [];
				dialogService.close('regionAdd');
				self.adding = false;
			}
		},
		


		addConfirm : function(){
			if (self.block_dbclick_add_region){
				return;
			}
			self.block_dbclick_add_region = true;
			created_entity = null;
			
			dataSend = {};
			coords = {}; 
			self.isLoading = true;  

			if(self.editing){
				dots = $rootScope.form.shape.getPath().getArray();
				dataSend.id = $rootScope.form.id;
				link = $rootScope.base_url+'/regions/edit';

				angular.forEach($rootScope.form.dots,function(val, index){
					coord = {};
					coord.lat = val.getPosition().lat();
					coord.lng = val.getPosition().lng();
					coord.id = val.id;          
					coords[index] = coord;
				});
			
			}else{
				if($rootScope.dotsCount < 3){
					$rootScope.message_error_modal = $rootScope.Users.translateText('Você deve selecionar no minimo três pontos no mapa');
					$timeout(function() {
						$rootScope.message_error_modal = '';
					}, 3000);
					self.isLoading = false;
					self.block_dbclick_add_region = false;
					return;
				}            
				link = $rootScope.base_url+'/regions/add';
				dots = $rootScope.shapeTemp.getPath().getArray();
				angular.forEach(dots,function(val, index){
					coord = {};
					dot.setMap(null);
					coord.lat = val.lat();
					coord.lng = val.lng();
					coords[index] = coord;
				});
				
			}

			dataSend.dots = coords;        
			dataSend.name = $rootScope.form.name;
			dataSend.color = $rootScope.form.color;
			

			$.ajax({
				url: link,
				type: 'POST',
				data: dataSend,
				success:function(data){
					$rootScope.set_errors_modal(data,'regionAdd');
					setTimeout(function(){
						self.block_dbclick_add_region = false;
					},2000);
					if(data.status == 1){
						created_entity = data.data;
						if(self.editing){
			                //esconder os marcadores da region em edição e limpar variaaveis da edição
			                
			                $rootScope.form.shape.setMap(null);
			                angular.forEach($rootScope.form.dots,function(pto,index){                
			                	pto.setMap(null);
			                });

			                angular.forEach(self.regions,function(val,indexRegion){
			                	if(val.id == created_entity.id){
			                		dots = [];
			                		path = [];
			                		angular.forEach($rootScope.form.dots,function(pto,index){                
			                			path.push({lat:parseFloat(pto.getPosition().lat()),lng:parseFloat(pto.getPosition().lng())});                              
			                			dot = Map.drawMarker(pto.getPosition().lat(), pto.getPosition().lng(),'','marker.png',$rootScope.Users.translateText('Guia da região'),'',0);
			                			dot.id = pto.id;
			                			dot.regionId = val.id;
			                			dot.index = index;
			                			Map.addListenerDotRegion(dot);
			                			dots.push(dot);
			                		});


			                		shape = Map.drawShape(path,$rootScope.form.color); 
			                		shape.setMap(Map.map); 

			                		region = [];
			                		region.name = $rootScope.form.name;
			                		region.color = $rootScope.form.color;
			                		region.id = val.id;
			                		region.dots = dots;
			                		region.statusView = true;
			                		region.statusEdit = false;
			                		region.shape = shape;   
			                		Map.addListenerRegion(region);
			                		self.regions[indexRegion] = region;

			                		self.editing = false;
			                		$rootScope.form = [];
			                		$rootScope.form.error = [];          

			                	}
			                })             
							return;
						}
		                 //encontrar a region cadastrada acom os dados novos no caso do cadastro
			              		path = [];
			              		dots = []
			              		angular.forEach(created_entity.dots,function(pto,index){                
			              			path.push({lat:parseFloat(pto.lat),lng:parseFloat(pto.lng)});                              
			              			dot = Map.drawMarker(pto.lat, pto.lng,'','marker.png',$rootScope.Users.translateText('Guia da região'),'',0);
			              			dot.id = pto.id;
			              			dot.setMap(null);
			              			dot.regionId = created_entity.id;
			              			dot.index = index;
			              			Map.addListenerDotRegion(dot);
			              			dots.push(dot);
			              		});

			              		shape = Map.drawShape(path,created_entity.color); 
			              		shape.setMap(Map.map); 
			              		region = [];
			              		region.name = created_entity.name;
			              		region.color = created_entity.color;
			              		region.id = created_entity.id;
			              		region.dots = dots;
			              		region.statusView = true;
			              		region.statusEdit = false;
			              		region.shape =  shape; 
			              		Map.addListenerRegion(region);
			              		region.shape.setMap(Map.map);
			              		self.regions.push(region);
		                		self.editing = false;

			              		self.addCancel();
			          
					}
				},
				complete:function(){
					self.isLoading = false;
					$rootScope.$digest();
				}
			})  
		},

		focus : function(index){
			self.regionsItemMenu[index].shape.setMap(Map.map);
			self.regionsItemMenu[index].statusView = 1;
			Map.setCenter(self.regionsItemMenu[index].dots[0].getPosition().lat(),self.regionsItemMenu[index].dots[0].getPosition().lng(),15);
		},
		
		view : function(index){
			if(self.regionsItemMenu[index].shape.getMap()){
				self.regionsItemMenu[index].shape.setMap(null);
				self.regionsItemMenu[index].statusView = 0;
			}else{
				self.regionsItemMenu[index].shape.setMap(Map.map);
				self.regionsItemMenu[index].statusView = 1;
				Map.setCenter(self.regionsItemMenu[index].dots[0].getPosition().lat(),self.regionsItemMenu[index].dots[0].getPosition().lng(),15);
			}
		},

		report : function(region){
			if ($rootScope.region_report_modal_open){
				$rootScope.message_error = $rootScope.Users.translateText('Feche a janela de relatorio atual para abrir uma nova');
                $timeout(function() {
                     $rootScope.message_error = '';
                }, 3000);
				return;
			}
			$rootScope.region_report_modal_open = true;
			dialogService.close('menuRegion');
			console.log(region);
			var options = {
					autoOpen: false,
					modal: false,
					title: $rootScope.Users.translateText('Relatorios - Regiao "') + region.name +'"',
					width: 352,
					height:'auto',
					resizable:false,
					dialogClass: "noclose", 
					dialogClass: "noclose no-scroll", 
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
						$rootScope.menuMap = false;  
						$rootScope.fixed_region_report_flag = false
						$rootScope.region_report_modal_open = false;;
					}
				};
				model = [];  
				self.region_report_inprg = true;	
				$rootScope.fixed_region_report_flag = true;
				$rootScope.fixedRegionReportShape = region.shape;
				$rootScope.form = [];
				$rootScope.form.error = [];          
				dialogService.open('fixedRegionReports','fixedRegionReports', model, options).then();
		},
		
		showAll : function(){
			if(self.viewAllRegions){
				self.viewAllRegions = false;
				angular.forEach(self.regions,function(region,index){     
					region.shape.setMap(null);
					region.statusView = false;
				});
			}else{
				self.viewAllRegions = true;
				angular.forEach(self.regions,function(region,index){     
					region.shape.setMap(Map.map);
					region.statusView = true;
				});
			}
		}

	}

	return self;

})

