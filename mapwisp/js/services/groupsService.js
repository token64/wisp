app.service('Groups', function($rootScope,dialogService, Projects){
	
	var self = {
		isLoading : false,
		//grupo selecionado para cadastro de projetos
		groupSelected : '',
		//grupos selecionados para serem vistos na tela
		groupsChecked : [],
		
		list : function(id){
			self.isLoading = true,
			link = $rootScope.base_url+'/groups/list_all'
			$.ajax({
				url: link,
				type: 'POST',
				success:function(data){
					self.groups = data;
					if (id) {
						self.groupSelected = id;
						$rootScope.groupSelected = id;
					} else{
						self.groupSelected = "";
						$rootScope.groupSelected = "";
					}
				},
				complete:function(){
					self.isLoading = false,
					$rootScope.$apply();
			        //Criar multiselect para grupos
			        $("#groups-select").multiselect({
			        	header: "GRUPOS",
			        	noneSelectedText: 'GRUPOS',
			        	selectedText: "GRUPOS",
			        });
			        $("#groups-select").on("multiselectclick", function(event, ui) { 
			        	/* event: the original event object 
			        	 * ui.value: value of the checkbox 
			        	 * ui.text: text of the checkbox 
			        	 * ui.checked: whether or not the input was checked or unchecked (boolean) */ 
			        	if (ui.checked){
			        		$("#groups-select").multiselect({selectedText: ui.text});
			        		$("#groups-select-menu").multiselect({selectedText: ui.text});
			        		self.groupSelected = ui.value;
			        	} else {
			        		if (ui.value == self.groupSelected){
				        		$("#groups-select-menu").multiselect({selectedText: 'GRUPOS'});
				        		$("#groups-select").multiselect({selectedText: 'GRUPOS'});
				        		self.groupSelected = null;
			        		}
			        	}
			        	//Refresh the selected groups, and then call the projects to be refreshed
			        	self.refreshSelectedVar($("#groups-select"));
			        	self.refreshCheckedBasedOnArray();
			        	Projects.list("select");
			        	$("#projects-select").multiselect('refresh');
			        	Projects.refreshChecked();
			        	$rootScope.Views.refreshShowItems();
			        	Projects.updateItemsMenu();
			        });
			        //FOR THE DROPDOWN MENU ------------ //
			        $("#groups-select-menu").multiselect({
			        	header: "GRUPOS",
			        	noneSelectedText: 'GRUPOS',
			        	selectedText: "GRUPOS",
			        });
			        $("#groups-select-menu").on("multiselectclick", function(event, ui) { 
			        	if (ui.checked){
			        		$("#groups-select-menu").multiselect({selectedText: ui.text});
			        		$("#groups-select").multiselect({selectedText: ui.text});
			        		self.groupSelected = ui.value;
			        	} else {
			        		if (ui.value == self.groupSelected){
				        		$("#groups-select-menu").multiselect({selectedText: 'GRUPOS'});
				        		$("#groups-select").multiselect({selectedText: 'GRUPOS'});
				        		self.groupSelected = null;
			        		}
			        	}
			        	//Refresh the selected groups, and then call the projects to be refreshed
			        	self.refreshSelectedVar($("#groups-select-menu"));
			        	self.refreshCheckedBasedOnArray();
			        	Projects.list("select");
			        	$("#projects-select").multiselect('refresh');
			        	$("#projects-select-menu").multiselect('refresh');
			        	Projects.refreshChecked();
			        	$rootScope.Views.refreshShowItems();
			        	Projects.updateItemsMenu();
			        });
			        //--------------------------------------//
				}
			})
		},
		
		/**
		 * refresh checked based on array
		 * Checks the items in the dropdown menu, based on the updated selected array - groupsChecked
		 * */
		refreshCheckedBasedOnArray : function(){
			angular.forEach(self.groups, function(group, index_group){
				if (itemInArray(group.id, self.groupsChecked)){
					$("#groups-select option").filter(function() {return $(this).val() == group.id; }).prop('selected', true);
					$("#groups-select-menu option").filter(function() {return $(this).val() == group.id; }).prop('selected', true);
				} else {
					$("#groups-select option").filter(function() {return $(this).val() == group.id; }).prop('selected', false);
					$("#groups-select-menu option").filter(function() {return $(this).val() == group.id; }).prop('selected', false);
				}
			});
			$("#groups-select").multiselect('refresh');
			$("#groups-select-menu").multiselect('refresh');
        	Projects.list("select");
        	$("#projects-select").multiselect('refresh');
        	$("#projects-select-menu").multiselect('refresh');
        	Projects.refreshChecked();
		},
		
		/**
		 * refresh checked based on array
		 * Checks the items in the dropdown menu, based on the updated selected array - groupsChecked
		 * This method is only called from the view. It has to be different, because it will select one group for adding items.
		 * */
		refreshCheckedBasedOnArrayViewChange : function(){
			angular.forEach(self.groups, function(group, index_group){
				if (itemInArray(group.id, self.groupsChecked)){
					$("#groups-select option").filter(function() {return $(this).val() == group.id; }).prop('selected', true);
					$("#groups-select-menu option").filter(function() {return $(this).val() == group.id; }).prop('selected', true);
					
					//Select group as group selected:
	        		$("#groups-select-menu").multiselect({selectedText: group.name});
	        		$("#groups-select").multiselect({selectedText: group.name});
	        		self.groupSelected = group.id;
				} else {
					$("#groups-select option").filter(function() {return $(this).val() == group.id; }).prop('selected', false);
					$("#groups-select-menu option").filter(function() {return $(this).val() == group.id; }).prop('selected', false);
				}
			});
			$("#groups-select").multiselect('refresh');
			$("#groups-select-menu").multiselect('refresh');
        	Projects.list("select");
        	$("#projects-select").multiselect('refresh');
        	$("#projects-select-menu").multiselect('refresh');
        	Projects.refreshChecked();
		},
		
		refreshSelectedVar : function(element){
        	//Refresh the selected groups
        	selected = element.multiselect('getChecked');
        	self.groupsChecked = [];
        	angular.forEach(selected, function(option){
        		self.groupsChecked.push(option.value);
        	});
		},
		
		select : function(id){
        	// id do grupo selecionado
        	self.groupSelected =  id;
        	$rootScope.groupSelected = id;
        	//Projects.list("select");
        },
		
        add : function(){
        	var options = {
        		autoOpen: false,
        		modal: true,
        		title:$rootScope.Users.translateText('Adicionar novo grupo'),
        		width: 300,
        		height:'auto',
        		resizable:true,
        		dialogClass: "noclose", 
                close:function(){
                	Projects.list("select");     
                },
        	};
        	model = [];  
        	$rootScope.form = [];
        	$rootScope.form.error = [];
        	$rootScope.form.optionGroup = "add";
        	//Listar projetos novamente, para  mostrar todas as opcoes no add.
            Projects.list();
        	dialogService.open('groupAdd','groupAdd', model, options).then();
        },
        
        addConfirm : function(){
        	self.isLoading = true;
        	$rootScope.form.error = [];
        	dataSend = {};
        	dataSend.name = $rootScope.form.name;
        	dataSend.projects = {};
        	angular.forEach($rootScope.form.projects,function(project_id,index){
        		dataSend.projects[index] = {};
        		dataSend.projects[index]['id'] = project_id;
        	});
        	
        	if ($rootScope.form.optionGroup == "add"){
        		link = $rootScope.base_url+'/groups/add';
        	} else if ($rootScope.form.optionGroup == "edit"){
        		link = $rootScope.base_url+'/groups/edit';
        		dataSend.id = self.groupSelected;
        	}
        	
        	$.ajax({
        		url: link,
        		type: 'POST',
        		data: dataSend,
        		success:function(data){
        			$rootScope.set_errors_modal(data,'groupAdd');
        			if(data.status == 1){
        				self.list(data.id);
        			}
        		},
        		complete:function(){
        			self.isLoading = false;
	       			$rootScope.$apply();
	       			$("#groups-select").multiselect('refresh');
	       			
        		}
        	})  
        },
		
        edit : function(){
        	var options = {
        		autoOpen: false,
        		modal: true,
        		title:'Editar Grupo',
        		width: 300,
        		height:'auto',
        		resizable:true,
        		dialogClass: "noclose",
                close:function(){
                	Projects.list("select");     
                },
        	};
        	model = [];  
        	$rootScope.form = [];
        	$rootScope.form.error = [];
            angular.forEach(self.groups,function(group, index_group){
                if(group.id == self.groupSelected){
                	$rootScope.form.name = group.name;
                	$rootScope.form.projects = [];
                	angular.forEach(group.projects, function(project, index_project){
                		$rootScope.form.projects.push("" + project.id);
                	});
                }
            })
        	$rootScope.form.optionGroup = "edit";
            //Listar projetos novamente, para  mostrar todas as opcoes no edit.
            Projects.list("edit");
        	dialogService.open('groupEdit','groupEdit', model, options).then();
        }
		
	}
	
	
	return self;
});