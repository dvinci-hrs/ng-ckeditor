'use strict';

(function (angular, factory) {
    if (typeof define === 'function' && define.amd) {
        define(['angular', 'ckeditor'], function (angular) {
            return factory(angular);
        });
    } else {
        return factory(angular);
    }
}(angular || null, function (angular) {
    var app = angular.module('ngCkeditor', []);
    var $defer, loaded = false;

    app.run(['$q', '$timeout', function ($q, $timeout) {
        $defer = $q.defer();

        if (angular.isUndefined(CKEDITOR)) {
            throw new Error('CKEDITOR not found');
        }
        CKEDITOR.disableAutoInline = true;

        function checkLoaded() {
            if (CKEDITOR.status === 'loaded') {
                loaded = true;
                $defer.resolve();
            } else {
                checkLoaded();
            }
        }

        CKEDITOR.on('loaded', checkLoaded);
        $timeout(checkLoaded, 100);
    }]);

    app.directive('ckeditor', ['$timeout', '$q', function ($timeout, $q) {

        return {
            restrict: 'AC',
            priority: 1,
            require: ['ngModel', '^?form'],
            scope: {
                config: '=?ckeditor'
            },
            link: function (scope, element, attrs, ctrls) {
                var ngModel = ctrls[0];
                var form = ctrls[1] || null;
                var EMPTY_HTML = '<p></p>',
                    isTextarea = element[0].tagName.toLowerCase() === 'textarea',
                    data = [],
                    dataDirty = false,
                    isReady = false;

                if (!isTextarea) {
                    element.attr('contenteditable', true);
                }

                var onLoad = function () {
                    var options = scope.config || {};

                    var instance = (isTextarea) ? CKEDITOR.replace(element[0], options) : CKEDITOR.inline(element[0], options),
                        configLoaderDef = $q.defer();

                    element.bind('$destroy', function () {
                        if (instance && CKEDITOR.instances[instance.name]) {
                            CKEDITOR.instances[instance.name].destroy();
                        }
                    });
                    var setModelData = function (setPristine) {
                        var data = instance.getData();
                        if (data === '') {
                            data = null;
                        }
                        $timeout(function () { // for key up event
                            if (setPristine !== true || data !== ngModel.$viewValue) {
                                ngModel.$setViewValue(data);
                            }

                            if (setPristine === true && form) {
                                form.$setPristine();
                            }
                        }, 0);
                    }, onUpdateModelData = function (setPristine) {
                        if (!data.length) {
                            return;
                        }

                        var item = data.pop() || EMPTY_HTML;
                        isReady = false;
                        dataDirty = false;
                        instance.setData(item, function () {
                            setModelData(setPristine);
                            if (dataDirty) {
                                onUpdateModelData();
                            } else {
                                isReady = true;
                            }
                        });
                    }, updateOEmbedProvider = function () {
                        var youtubeUrls = [];
                        if (jQuery.fn.oembed) {
                            if (jQuery.fn.oembed.providers.length) {
                                var youtubeArr = jQuery.grep(jQuery.fn.oembed.providers, function (a) {
                                    return a.name === "youtube";
                                });
                                youtubeUrls = youtubeArr[0].urlschemes;
                                youtubeUrls.push("youtube-nocookie.com/embed");
                            }
                            jQuery.fn.updateOEmbedProvider('youtube', null, youtubeUrls, null, null);
                        }
                    };

                    instance.on('pasteState', setModelData);
                    instance.on('change', setModelData);
                    instance.on('blur', setModelData);
                    //instance.on('key',          setModelData); // for source view

                    instance.on('instanceReady', function () {
                        // add new url to provider youtube for ckeditor-oembed-plugin
                        // see:
                        // https://github.com/starfishmod/jquery-oembed-all/blob/master/jquery.oembed.js#L468
                        // https://github.com/starfishmod/jquery-oembed-all/blob/master/jquery.oembed.js#L496
                        //
                        // Tested with:
                        // https://www.youtube.com/watch?v=PTo-DsPIlDk
                        // https://www.youtube-nocookie.com/embed/nShlloNgM2E
                        updateOEmbedProvider();

                        scope.$emit('ckeditor.ready', instance);
                        scope.$apply(function () {
                            onUpdateModelData(true);
                        });

                        instance.document.on('keyup', setModelData);
                    });
                    instance.on('customConfigLoaded', function () {
                        configLoaderDef.resolve();
                    });

                    ngModel.$render = function () {
                        data.push(ngModel.$viewValue);
                        if (isReady) {
                            onUpdateModelData();
                        } else {
                            dataDirty = true;
                        }
                    };
                };

                if (CKEDITOR.status === 'loaded') {
                    loaded = true;
                }
                if (loaded) {
                    onLoad();
                } else {
                    $defer.promise.then(onLoad);
                }
            }
        };
    }]);

    return app;
}));