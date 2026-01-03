var app = angular.module('myApp', []);
    app.controller('myCtrl', function($scope, $http) {
        let language; // Backend'den gelen dil parametresi (örneğin 'en' veya 'tr')
        language = getCookie("languages")
        if (language != "") {
            loadMenu(language);
        } else {
            language = navigator.language || navigator.userLanguage
            loadMenu(language);
        }

        function getCookie(cname) {
            let name = cname + "=";
            let decodedCookie = decodeURIComponent(document.cookie);
            let ca = decodedCookie.split(';');
            for(let i = 0; i < ca.length; i++) {
                let c = ca[i];
                while (c.charAt(0) == ' ') {
                c = c.substring(1);
                }
                if (c.indexOf(name) == 0) {
                return c.substring(name.length, c.length);
                }
            }
            return "";
        }
        
        function loadMenu(language) {
            //var jsonFile = language === 'en' ? 'english.json' : 'turkish.json';
            language = "../languages/"+language+".json";
            $http.get(language).then(function(response) {
            $scope.fields = response.data.fields;
            $scope.title = response.data.title;
            $scope.process = response.data.process
            });
        } 
    });

    $('#langs > li').click(function() {
        document.cookie='languages=' + $(this).data('val')
        location.reload();
    });

