app.service('Projects', function($rootScope,dialogService){
	
	var self = {
		isLoading : false,
		//projeto selecionado para cadastro de itens
		projectSelected : '',
		//projetos selecionados para serem vistos na tela
		projectsChecked : [],
		//Projects loaded from database
		projectsLoaded : [],

		list : function(option){
			if ((option == "select") && ($rootScope.Groups.groupsChecked.length > 0)){
				//Se grupos estiverem selecionados, mostra somente projetos destes grupos
				self.projects = [];
				angular.forEach(self.projectsLoaded,function(project,index){
					adicionado = false;
					angular.forEach(project.groups,function(group,index_group){
						if ((itemInArray(group.id, $rootScope.Groups.groupsChecked)) && (!adicionado)){
							self.projects.push(project);
							adicionado = true;
						}
					});
				});
				$rootScope.$apply();
		        $("#projects-select").multiselect('refresh');
		        //self.refreshChecked();
			} else {
				self.isLoading = true;
				link = $rootScope.base_url+'/projects/list_all'
				$.ajax({
					url: link,
					type: 'POST',
					success:function(data){
						self.projects = [];
						self.projectsLoaded = [];
						//Se nenhum grupo estiver selecionado, mostra todos os projetos
						self.projects = data;
						self.projectsLoaded = data;
						self.projectSelected = '';
					},
					complete:function(){
						self.isLoading = false,
						$rootScope.$apply();
				        //Criar multiselect para projetos
						
				        $("#projects-select").multiselect({
				        	header: "PROJETOS",
				        	noneSelectedText: 'PROJETOS',
				        	selectedText: "PROJETOS"
				        });
				        $("#projects-select").on("multiselectclick", function(event, ui) { 
				        	/* event: the original event object 
				        	 * ui.value: value of the checkbox 
				        	 * ui.text: text of the checkbox 
				        	 * ui.checked: whether or not the input was checked or unchecked (boolean) */ 
				        	if (ui.checked){
				        		$("#projects-select").multiselect({selectedText: ui.text});
				        		$("#projects-select-menu").multiselect({selectedText: ui.text});
				        		//Update the selected project -> this is the project used to create new items
				        		self.projectSelected = ui.value;
				        	} else {
				        		//check if the selected project was unchecked. If so, empty the projectSelected var
				        		if (ui.value == self.projectSelected){
				        			self.projectSelected = '';
				        			$("#projects-select").multiselect({selectedText: 'PROJETOS'});
					        		$("#projects-select-menu").multiselect({selectedText: 'PROJETOS'});
				        		}
				        	}
				        	//Refresh the selected projects
				        	self.refreshSelectedVar($("#projects-select"));
				        	$rootScope.Views.refreshShowItems();
				        	self.updateItemsMenu();
				        });
				        //FOR THE DROPDOWN MENU ------------ //
				        $("#projects-select-menu").multiselect({
				        	header: "PROJETOS",
				        	noneSelectedText: 'PROJETOS',
				        	selectedText: "PROJETOS"
				        });
				        $("#projects-select-menu").on("multiselectclick", function(event, ui) { 
				        	if (ui.checked){
				        		$("#projects-select").multiselect({selectedText: ui.text});
				        		$("#projects-select-menu").multiselect({selectedText: ui.text});
				        		//Update the selected project -> this is the project used to create new items
				        		self.projectSelected = ui.value;
				        	} else {
				        		//check if the selected project was unchecked. If so, empty the projectSelected var
				        		if (ui.value == self.projectSelected){
				        			self.projectSelected = '';
				        			$("#projects-select").multiselect({selectedText: 'PROJETOS'});
					        		$("#projects-select-menu").multiselect({selectedText: 'PROJETOS'});
				        		}
				        	}
				        	//Refresh the selected projects
				        	self.refreshSelectedVar($("#projects-select-menu"));
				        	$rootScope.Views.refreshShowItems();
				        	self.updateItemsMenu();
				        });
				        //-----------------------------------//
				        $("#projects-select").multiselect('refresh');
				        $("#projects-select-menu").multiselect('refresh');
				        //self.refreshChecked();
					}
				})  
			}
		},

		/**
		 * Updat Items Menu
		 * Updates the items that appear in the items menu, for all the types of items that exist
		 * */
		updateItemsMenu : function(){
			//Update Cables
			$rootScope.Cables.updateItemsMenu();
			//Update Access Points
			$rootScope.AccessPoints.updateItemsMenu();
			//Update Regions
			$rootScope.Regions.updateItemsMenu();
			//Update Reserves
			$rootScope.Reserves.updateItemsMenu();
			
			$rootScope.$apply();
		},
		
		/**
		 * refresh Checked
		 * based on the groups that are selected, selects the projects
		 * */
		refreshChecked : function(){
			//For each project, for each of its groups, if the group is checked, the project is checked too, uncheck the project otherwise!
			angular.forEach(self.projects, function(project, index_project){
				selecionado = false;
				angular.forEach(project.groups, function(group, index_group){
					if (!selecionado){
						if (itemInArray(group.id, $rootScope.Groups.groupsChecked)){
							$("#projects-select option").filter(function() {return $(this).val() == project.id; }).prop('selected', true);
							$("#projects-select-menu option").filter(function() {return $(this).val() == project.id; }).prop('selected', true);
							
							//Select the project for saving items:
			        		$("#projects-select").multiselect({selectedText: project.name});
			        		$("#projects-select-menu").multiselect({selectedText: project.name});
			        		//Update the selected project -> this is the project used to create new items
			        		self.projectSelected = project.id;
			        		
							selecionado = true;
						} else {
							$("#projects-select option").filter(function() {return $(this).val() == project.id; }).prop('selected', false);
							$("#projects-select-menu option").filter(function() {return $(this).val() == project.id; }).prop('selected', false);
						}
					}
				});
			});
			$("#projects-select").multiselect('refresh');
			$("#projects-select-menu").multiselect('refresh');
        	//Refresh the selected projects
        	self.refreshSelectedVar($("#projects-select"));
        	self.updateItemsMenu();
		},
		
		/**
		 * refresh checked based on array
		 * Checks the items in the dropdown menu, based on the updated selected array - projectsChecked
		 * */
		refreshCheckedBasedOnArray : function(){
			console.log("refresh based on array - PROJECTS (i think this will never fire)")
			angular.forEach(self.projects, function(project, index_project){
				if (itemInArray(project.id, self.projectsChecked)){
					$("#projects-select option").filter(function() {return $(this).val() == project.id; }).prop('selected', true);
					$("#projects-select-menu option").filter(function() {return $(this).val() == project.id; }).prop('selected', true);
				} else {
					$("#projects-select option").filter(function() {return $(this).val() == project.id; }).prop('selected', false);
					$("#projects-select-menu option").filter(function() {return $(this).val() == project.id; }).prop('selected', false);
				}
			});
			$("#projects-select").multiselect('refresh');
			$("#projects-select-menu").multiselect('refresh');
		},
		
		refreshSelectedVar : function(element){
        	//Refresh the selected projects
        	selected = element.multiselect('getChecked');
        	self.projectsChecked = [];
        	angular.forEach(selected, function(option){
        		self.projectsChecked.push(option.value);
        	});
		},
		
		select : function(id){
        	// id do projeto selecionado
        	self.projectSelected =  id;
        	$("#projects-select").multiselect({selectedText: $("#projects-select option").filter(function() {return $(this).val() == id;}).text()});
        },


        addConfirm : function(){
        	link = $rootScope.base_url+'/projects/add';
        	self.isLoading = true;
        	$rootScope.form.error = [];
        	dataSend = {};
        	if ($rootScope.Groups.groupSelected){
        		dataSend.groups = {};
        		dataSend.groups[0] = {};
        		dataSend.groups[0]['id'] = $rootScope.Groups.groupSelected;
        	}
        	dataSend.name = $rootScope.form.name;
        	$.ajax({
        		url: link,
        		type: 'POST',
        		data: dataSend,
        		success:function(data){
        			$rootScope.set_errors_modal(data,'projectAdd');
        			if(data.status == 1){
        				self.list();
        			}
        		},
        		complete:function(){
        			self.isLoading = false;
	       			$rootScope.$apply();
	       			$("#projects-select").multiselect('refresh');
        		}
        	})  
        },

        add : function(){
        	var options = {
        		autoOpen: false,
        		modal: true,
        		title: $rootScope.Users.translateText('Adicionar novo projeto'),
        		width: 300,
        		height:'auto',
        		resizable:true,
        		dialogClass: "noclose", 
        	};
        	model = [];  
        	$rootScope.form = [];
        	$rootScope.form.error = [];
        	dialogService.open('projectAdd','projectAdd', model, options).then();
        }

    }
    
    return self;

})

