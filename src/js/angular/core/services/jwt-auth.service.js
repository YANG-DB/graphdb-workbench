import 'angular/core/services';
import 'angular/rest/security.rest.service';
import {UserRole} from 'angular/utils/user-utils';

angular.module('graphdb.framework.core.services.jwtauth', [
    'ngCookies',
    'toastr',
    'graphdb.framework.rest.security.service'
])
    .service('$jwtAuth', ['$http', '$cookies', '$cookieStore', 'toastr', '$location', '$rootScope', 'SecurityRestService',
        function ($http, $cookies, $cookieStore, toastr, $location, $rootScope, SecurityRestService) {
            const jwtAuth = this;

            $rootScope.deniedPermissions = {};
            $rootScope.setPermissionDenied = function (path) {
                if (path === '/' || path === '/login' || !jwtAuth.isAuthenticated()) {
                    return false;
                }
                $rootScope.deniedPermissions[path] = true;
                return true;
            };
            $rootScope.hasPermission = function () {
                const path = $location.path();
                return !$rootScope.deniedPermissions[path];
            };
            $rootScope.redirectToLogin = function (expired) {
                if (expired && jwtAuth.getAuthToken()) {
                    toastr.error('Your authentication token has expired. Please login again.');
                    jwtAuth.clearAuthentication();
                }

                if ($location.url().indexOf('/login') !== 0) {
                    // remember where we were so we can return there
                    $rootScope.returnToUrl = $location.url();
                }
                $location.path('/login');
            };
            $rootScope.hasExternalAuthUser = function () {
                return jwtAuth.hasExternalAuthUser();
            };

            this.principalCookieName = 'com.ontotext.graphdb.principal' + $location.port();
            this.authCookieName = 'com.ontotext.graphdb.auth' + $location.port();

            this.securityEnabled = true;
            this.freeAccess = false;
            this.hasOverrideAuth = false;
            this.externalAuthUser = false;

            const that = this;

            this.clearCookies = function () {
                delete $cookies[that.authCookieName];
                $cookieStore.remove(that.principalCookieName);
            };

            this.initSecurity = function () {
                this.auth = $cookies[this.authCookieName];
                this.principal = $cookieStore.get(this.principalCookieName);

                SecurityRestService.getSecurityConfig().then(function (res) {
                    that.securityEnabled = res.data.enabled;
                    that.externalAuth = res.data.hasExternalAuth;
                    that.authImplementation = res.data.authImplementation;

                    if (that.securityEnabled) {
                        const freeAccessData = res.data.freeAccess;
                        that.freeAccess = freeAccessData.enabled;
                        if (that.freeAccess) {
                            that.freeAccessPrincipal = {
                                authorities: freeAccessData.authorities,
                                appSettings: freeAccessData.appSettings
                            };
                        }

                        SecurityRestService.getAuthenticatedUser().
                        success(function(data, status, headers) {
                            if (that.auth) {
                                // There is a previous authentication via JWT, it's still valid
                                // so refresh the principal
                                that.externalAuthUser = false;
                                that.principal = data;
                                $rootScope.$broadcast('securityInit', that.securityEnabled, true, that.freeAccess);
                                // console.log('previous JWT authentication ok');
                            } else {
                                // There is no previous authentication but we got a principal via
                                // an external authentication mechanism (e.g. Kerberos)
                                that.externalAuthUser = true;
                                that.authenticate(data, headers); // this will emit securityInit
                                // console.log('external authentication ok');
                            }
                        }).finally(function() {
                            // Strictly speaking we should try this in the error() callback but
                            // for some reason it doesn't get called.
                            if (!that.hasExplicitAuthentication()) {
                                that.principal = that.freeAccessPrincipal;
                                $rootScope.$broadcast('securityInit', that.securityEnabled, false, that.freeAccess);
                                // console.log('free access fallback');
                            }
                        });
                    } else {
                        that.clearCookies();
                        const overrideAuthData = res.data.overrideAuth;
                        that.hasOverrideAuth = overrideAuthData.enabled;
                        if (that.hasOverrideAuth) {
                            that.principal = {
                                username: 'overrideauth',
                                authorities: overrideAuthData.authorities,
                                appSettings: overrideAuthData.appSettings
                            };
                            $rootScope.$broadcast('securityInit', that.securityEnabled, true, that.hasOverrideAuth);

                        } else {
                            SecurityRestService.getAdminUser().then(function (res) {
                                that.principal = {username: 'admin', appSettings: res.data.appSettings, authorities: res.data.grantedAuthorities}
                                $rootScope.$broadcast('securityInit', that.securityEnabled, true, that.hasOverrideAuth);
                            });
                        }
                    }
                });
            };

            this.initSecurity();


            this.isSecurityEnabled = function () {
                return this.securityEnabled;
            };

            this.hasExternalAuth = function () {
                return this.externalAuth;
            };

            this.getAuthImplementation = function () {
                return this.authImplementation;
            };

            this.isFreeAccessEnabled = function () {
                return this.freeAccess;
            };

            this.isDefaultAuthEnabled = function () {
                return this.hasOverrideAuth && this.principal && this.principal.username === 'overrideauth';
            };

            this.getAuthToken = function () {
                return this.auth;
            };

            this.toggleSecurity = function (enabled) {
                if (enabled !== this.securityEnabled) {
                    this.securityEnabled = enabled;
                    SecurityRestService.toggleSecurity(enabled).then(function () {
                        toastr.success('Security has been ' + (enabled ? 'enabled.' : 'disabled.'));
                        that.clearCookies();
                        that.initSecurity();
                    }, function (err) {
                        toastr.error(err.data.error.message, 'Error');
                    });
                }
            };

            this.toggleFreeAccess = function (enabled, authorities, appSettings, updateFreeAccess) {
                if (enabled !== this.freeAccess || updateFreeAccess) {
                    this.freeAccess = enabled;
                    if (enabled) {
                        this.freeAccessPrincipal = {authorities: authorities, appSettings: appSettings};
                    } else {
                        this.freeAccessPrincipal = undefined;
                    }
                    SecurityRestService.setFreeAccess({
                        enabled: enabled ? 'true' : 'false',
                        authorities: authorities,
                        appSettings: appSettings
                    }).then(function () {
                        if (updateFreeAccess) {
                            toastr.success('Free access settings have been updated.');
                        } else {
                            toastr.success('Free access has been ' + (enabled ? 'enabled.' : 'disabled.'));
                        }
                    }, function (err) {
                        toastr.error(err.data.error.message, 'Error');
                    });
                    $rootScope.$broadcast('securityInit', this.securityEnabled, this.hasExplicitAuthentication(), this.freeAccess);
                }
            };

            this.setAuthHeaders = function () {
                $http.defaults.headers.common['Authorization'] = this.auth;
                $.ajaxSetup()['headers'] = $.ajaxSetup()['headers'] || {};
                $.ajaxSetup()['headers']['Authorization'] = this.auth;
            };
            this.setAuthHeaders();

            this.authenticate = function (data, headers) {
                this.clearCookies();
                if (headers('Authorization')) {
                    this.auth = headers('Authorization');
                    $cookies[this.authCookieName] = this.auth;
                    this.externalAuthUser = false;
                }

                this.principal = data;

                $cookieStore.put(this.principalCookieName, this.principal);
                this.setAuthHeaders();
                $rootScope.deniedPermissions = {};
                $rootScope.$broadcast('securityInit', this.securityEnabled, this.hasExplicitAuthentication(), this.freeAccess);
            };

            this.hasExternalAuthUser = function () {
                return this.externalAuthUser;
            };

            this.hasExplicitAuthentication = function () {
                return this.auth !== undefined || this.externalAuthUser;
            };

            this.getPrincipal = function () {
                return this.principal;
            };

            this.clearAuthentication = function () {
                this.auth = undefined;
                this.principal = this.freeAccessPrincipal;
                this.clearCookies();
                this.setAuthHeaders();
                $rootScope.$broadcast('securityInit', this.securityEnabled, false, this.freeAccess);
            };

            this.isAuthenticated = function () {
                return !this.securityEnabled || this.auth !== undefined;
            };

            this.hasPermission = function () {
            };

            this.hasRole = function (role) {
                if (role !== undefined && (this.securityEnabled || this.hasOverrideAuth)) {
                    if ('string' === typeof role) {
                        role = [role];
                    }
                    const hasPrincipal = !_.isEmpty(this.principal);
                    if (!hasPrincipal) {
                        return false;
                    }
                    if (role[0] === 'IS_AUTHENTICATED_FULLY') {
                        return hasPrincipal;
                    } else {
                        return _.intersection(role, this.principal.authorities).length > 0;
                    }
                } else {
                    return true;
                }
            };

            this.isAdmin = function () {
                return this.hasRole(UserRole.ROLE_ADMIN);
            };

            this.checkForWrite = function (menuRole, location, repo) {
                if ('WRITE_REPO' === menuRole) {
                    return this.canWriteRepo(location, repo);
                }
                return this.hasRole(menuRole);
            };

            this.hasAdminRole = function () {
                return this.isAdmin() || this.hasRole(UserRole.ROLE_REPO_MANAGER);
            };

            this.canWriteRepo = function (location, repo) {
                if (_.isEmpty(location) || _.isEmpty(repo)) {
                    return false;
                }
                if (this.securityEnabled || this.hasOverrideAuth) {
                    if (_.isEmpty(this.principal)) {
                        return false;
                    } else if (this.hasAdminRole()) {
                        return true;
                    }
                    return this.checkRights(location, repo, 'WRITE');
                } else {
                    return true;
                }
            };

            this.canReadRepo = function (location, repo) {
                if (_.isEmpty(location) || _.isEmpty(repo)) {
                    return false;
                }
                if (this.securityEnabled) {
                    if (_.isEmpty(this.principal)) {
                        return false;
                    } else if (this.hasAdminRole()) {
                        return true;
                    }
                    return this.checkRights(location, repo, 'READ');
                } else {
                    return true;
                }
            };

            this.checkRights = function (location, repo, action) {
                for (let i = 0; i < this.principal.authorities.length; i++) {
                    const authRole = this.principal.authorities[i];
                    const parts = authRole.split('_', 2);
                    const repoPart = authRole.slice(parts[0].length + parts[1].length + 2);
                    if (parts[0] === action && (repoPart === repo || repo !== 'SYSTEM' && repoPart === '*')) {
                        return true;
                    }
                }
                return false;
            };
        }]);
