import 'angular/core/services';
import 'angular/core/directives';
import 'angular/security/controllers';
import 'angular/core/services/jwt-auth.service';

const modules = [
    'toastr',
    'ui.bootstrap',
    'ngRoute',
    'graphdb.framework.security.controllers',
    'graphdb.framework.core.interceptors.unauthorized',
    'graphdb.framework.core.services.jwtauth'
];

angular.module('graphdb.framework.security', modules);
