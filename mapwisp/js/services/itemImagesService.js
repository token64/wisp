app.service('ItemImages', function($rootScope, dialogService, $q){
    var self = {
        isLoading : false,
        isUploading : false,
        itemImagesData : {},
        itemName : "",
        itemTypeName : "",

        buildGetImagesUrl : function(item_type, item_id, dot_id = null){
            let url = $rootScope.base_url+'/item_images?item_type='+item_type+'&item_id='+item_id;
            if (dot_id !== null && dot_id !== ""){
                url += '&dot_id='+dot_id;
            }
            return url;
        },
        
        loadImages : function(item_type, item_id, dot_id = null) {
            var d = $q.defer();
            self.isLoading = true;
            
            // Get images for access point
            $.ajax({
                url: self.buildGetImagesUrl(item_type, item_id, dot_id),
                type: 'GET',
                success: function(itemImages){
                    // When images are returned, set the to property to show in modal
                    self.itemImagesData = itemImages.images;
                    self.itemName = itemImages.item_name;
                    self.itemTypeName = itemImages.item_type_name;
                    self.isLoading = false;
                    $rootScope.$apply();
                    d.resolve();
                },
                complete: function(){
                    self.isLoading = false;
                    $rootScope.$apply();
                }
            });
            return d.promise;
        },

        uploadImage : function(file, itemType, itemId){
            var d = $q.defer();
            self.isUploading = true;
            $rootScope.$apply();

            var formData = new FormData();
            formData.append('file',file);
            formData.append('item_type', itemType);
            formData.append('item_id', itemId);
            
            // Get images for access point
            $.ajax({
                url: $rootScope.base_url+'/item_images/upload',
                data: formData,
                type: 'POST',
                processData: false,
                contentType: false,
                success: function(result){
                    self.isUploading = false;
                    $rootScope.$apply();
                    d.resolve(result);
                },
                complete: function(){
                    self.isUploading = false;
                    $rootScope.$apply();
                }
            });
            return d.promise;
        },

        removeImage : function(itemImageId) {
            var d = $q.defer();
            self.isLoading = true;

            // Send delete request
            $.ajax({
                url: $rootScope.base_url+'/item_images/delete',
                data: {id: itemImageId},
                type: 'POST',
                success: function(result){
                    self.isLoading = false;
                    $rootScope.$apply();
                    d.resolve(result);
                },
                complete: function(){
                    self.isLoading = false;
                    $rootScope.$apply();
                }
            });

            return d.promise;
        },

        edit : function(itemData) {
            var d = $q.defer();
            self.isLoading = true;

            // Send edit request
            $.ajax({
                url: $rootScope.base_url+'/item_images/edit',
                data: itemData,
                type: 'POST',
                success: function(result){
                    self.isLoading = false;
                    $rootScope.$apply();
                    d.resolve(result);
                },
                complete: function(){
                    self.isLoading = false;
                    $rootScope.$apply();
                }
            });

            return d.promise;
        },

        showImages : function(item_type, item_id, dot_id = null){
            if (dot_id !== null){
                console.log("dot_id = " + dot_id);
            }

            $rootScope.itemImages_itemType = item_type;
            $rootScope.itemImages_itemId = item_id;

            // Open Image modal
            dialogService.open('itemImagesModal','itemImagesModal', [], {
                autoOpen: false,
                modal: true,
                title: $rootScope.Users.translateText('Imagens'),
                width: 1200,
                height:700,
                maxHeight: 600,
                resizable:false,
                close:function(){
                    $rootScope.itemImages_itemType = null;
                    $rootScope.itemImages_itemId = null;
                }
            });
        },
    };

    return self;
});
