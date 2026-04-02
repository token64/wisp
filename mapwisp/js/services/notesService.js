app.service('Notes', function(Map,Functions,$rootScope,LevelsAndModes){
	
	var self = {
		isLoading : false,
		viewNotes : false,
          editing : false,
          adding : false,
		notes : [],

		viewAll : function(){
			if(self.viewNotes){
				angular.forEach(self.notes,function(val,index){
					//val.marker.setMap(null);
					$rootScope.Markers.removeFromMap(val.marker);
				});            
				self.viewNotes = 0;      
			}else{
				angular.forEach(self.notes,function(val,index){
					//val.marker.setMap(Map.map); 
					$rootScope.Markers.addToMap(val.marker);
				});               
				self.viewNotes = 1;   
			} 
		},


		deleteConfirm : function(){
			link = $rootScope.base_url+'/notes/delete'
			$.ajax({
				url: link,
				type: 'POST',
				data: {id:$rootScope.note_id},
				success:function(data){
					$rootScope.set_errors_modal(data,'noteDelete');
					if(data.status == 1){
						self.list(true);
					}
				},
				complete:function(){
					$rootScope.$apply();
				}
			})  
		},


          list : function(flag){

               self.isLoading = true;
               link = $rootScope.base_url+'/notes/list_all'
               $.ajax({
                    url: link,
                    type: 'POST',
                    success:function(data){
                         notes = [];
                         angular.forEach(self.notes,function(val,index){
                              //val.marker.setMap(null);   
                              $rootScope.Markers.removeFromMap(val.marker);
                         });
                         self.notes = [];
                         if(data.length > 0){

                              angular.forEach(data,function(val,index){
                                   note = val;
                                   note.marker =  Map.drawMarker(val.dot.lat, val.dot.lng,val.dot.id,'note.png',val.title,'',0);
                                   if(LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_ADMINISTRADOR]) || LevelsAndModes.isLevel([LevelsAndModes.levels.NIVEL_TECNICO])){
                                	   note.marker.draggable = true;
                                   } else {
                                	   note.marker.draggable = false;
                                   }
                                   note.note = Map.drawNote(val.title, val.description, Functions.date_format(val.date_created));
                                   Map.addListenerNote(note);
                                   if(flag){
                                        //note.marker.setMap(Map.map);
                                        $rootScope.Markers.addToMap(note.marker);
                                        self.viewNotes = true;
                                   };
                                   notes.push(note);
                              });
                         }
                         self.isLoading = false;
                         self.notes = notes;
                    },
                    complete:function(){
                         $rootScope.$apply();
                    }
               })  
          },


          add : function(){
               var options = {
                    autoOpen: false,
                    modal: true,
                    title: $rootScope.Users.translateText('Adicionar nota'),
                    width: 300,
                    height:'auto',
                    resizable:true,
                    dialogClass: "noclose", 
               };
               model = [];  
               self.adding = true;
               $rootScope.form = [];
               $rootScope.form.error = [];
               if ($rootScope.menuMap){
                $rootScope.dialogService.close('menuMap');
                $rootScope.menuMap = false;
               }
               if ($rootScope.menuMapViewExport){
                $rootScope.dialogService.close('menuMapViewExport');
                $rootScope.menuMapViewExport = false;
               }
               $rootScope.dialogService.open('noteAdd','noteAdd', model, options).then();
          },


          addConfirm : function(){

               $rootScope.form.error = [];

               data = {};
               data.title = $rootScope.form.title;
               data.description = $rootScope.form.description;

               if($rootScope.form.public){
                    data.public = 1;
               }else{
                    data.public = 0;  
               }             

               if(self.editing){
                    link = $rootScope.base_url+'/notes/edit'  
                    data.id = $rootScope.form.id;
               }else{
                    link = $rootScope.base_url+'/notes/add'  
                    data.dot = {};
                    data.dot.lat = $rootScope.event.latLng.lat();
                    data.dot.lng = $rootScope.event.latLng.lng();
               }

               $.ajax({
                    url: link,
                    type: 'POST',
                    data: data,
                    success:function(data){
                         $rootScope.set_errors_modal(data,'noteAdd');
                         if(data.status == 1){
                              self.list(true);
                         }
                    },
                    complete:function(){
                         $rootScope.$apply();
                    }
               })  
           }
	}

     return self;
})

