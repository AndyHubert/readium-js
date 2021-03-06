//  Copyright (c) 2014 Readium Foundation and/or its licensees. All rights reserved.
//  
//  Redistribution and use in source and binary forms, with or without modification, 
//  are permitted provided that the following conditions are met:
//  1. Redistributions of source code must retain the above copyright notice, this 
//  list of conditions and the following disclaimer.
//  2. Redistributions in binary form must reproduce the above copyright notice, 
//  this list of conditions and the following disclaimer in the documentation and/or 
//  other materials provided with the distribution.
//  3. Neither the name of the organization nor the names of its contributors may be 
//  used to endorse or promote products derived from this software without specific 
//  prior written permission.

define(['jquery', 'URIjs', './discover_content_type', 'biblemesh_Settings', 'i18nStrings'], function ($, URI, ContentTypeDiscovery, Settings, Strings) {

    var PlainResourceFetcher = function(parentFetcher){

        var ebookURL = parentFetcher.getEbookURL();
        var ebookURL_filepath = parentFetcher.getEbookURL_FilePath();

        var self = this;

        // INTERNAL FUNCTIONS

        function fetchFileContents(pathRelativeToPackageRoot, readCallback, onerror) {
            var fileUrl = self.resolveURI(pathRelativeToPackageRoot);

            if (typeof pathRelativeToPackageRoot === 'undefined') {
                throw 'Fetched file relative path is undefined!';
            }

            var xhr = new XMLHttpRequest();
            xhr.open('GET', fileUrl, true);
            xhr.responseType = 'arraybuffer';
            xhr.onerror = onerror;

            xhr.onload = function (loadEvent) {
                readCallback(xhr.response);
            };

            xhr.send();
        }


        // PUBLIC API

        this.resolveURI = function (pathRelativeToPackageRoot) {
    
            var pathRelativeToPackageRootUri = undefined;
            try {
                pathRelativeToPackageRootUri = new URI(pathRelativeToPackageRoot);
            } catch(err) {
                console.error(err);
                console.log(pathRelativeToPackageRoot);
            }
            if (pathRelativeToPackageRootUri && pathRelativeToPackageRootUri.is("absolute")) return pathRelativeToPackageRoot; //pathRelativeToPackageRootUri.scheme() == "http://", "https://", "data:", etc.


            var url = ebookURL_filepath;
            
            try {
                //url = new URI(relativeUrl).absoluteTo(url).search('').hash('').toString();
                url = new URI(url).search('').hash('').toString();
            } catch(err) {
                console.error(err);
                console.log(url);
            }
            
            return url + (url.charAt(url.length-1) == '/' ? "" : "/") + pathRelativeToPackageRoot;
        };

        this.fetchFileContentsText = function(pathRelativeToPackageRoot, fetchCallback, onerror) {
            var fileUrl = self.resolveURI(pathRelativeToPackageRoot);

            if (typeof fileUrl === 'undefined') {
                throw 'Fetched file URL is undefined!';
            }

            var optionalFetch = (pathRelativeToPackageRoot.indexOf("META-INF/com.apple.ibooks.display-options.xml") == 0)
            || (pathRelativeToPackageRoot.indexOf("META-INF/encryption.xml") == 0);

            Settings.get('404:' + fileUrl, function(is404) {

                if(optionalFetch && is404) {
                    console.log("Skipped fetch of " + fileUrl + " due to presence of localstorage value: " + '404:' + fileUrl);
                    onerror();
                    return;
                }

                $.ajax({
                    // encoding: "UTF-8",
                    // mimeType: "text/plain; charset=UTF-8",
                    // beforeSend: function( xhr ) {
                    //     xhr.overrideMimeType("text/plain; charset=UTF-8");
                    // },
                    isLocal: fileUrl.indexOf("http") === 0 ? false : true,
                    url: fileUrl,
                    dataType: 'text', //https://api.jquery.com/jQuery.ajax/
                    async: true,
                    success: function (result) {
                        fetchCallback(result);
                    },
                    error: function (xhr, status, errorThrown) {
                        if(xhr.status == 403) {  // biblemesh_
                            if(location.search.match(/[\?&]widget=1/)) {
                                parent.postMessage({
                                    action: 'forbidden',
                                    iframeid: window.name,
                                    payload: Strings.biblemesh_widget_no_access,
                                }, '*');
                            } else {
                                location.reload();
                            }
                            return;
                        }
                        if(optionalFetch) {
                            Settings.put('404:' + fileUrl, 1)
                        }
                        onerror(new Error(errorThrown));
                    }
                });

            })
            
        };

        this.fetchFileContentsBlob = function(pathRelativeToPackageRoot, fetchCallback, onerror) {

            var decryptionFunction = parentFetcher.getDecryptionFunctionForRelativePath(pathRelativeToPackageRoot);
            if (decryptionFunction) {
                var origFetchCallback = fetchCallback;
                fetchCallback = function (unencryptedBlob) {
                    decryptionFunction(unencryptedBlob, function (decryptedBlob) {
                        origFetchCallback(decryptedBlob);
                    });
                };
            }
            fetchFileContents(pathRelativeToPackageRoot, function (contentsArrayBuffer) {
                var blob = new Blob([contentsArrayBuffer], {
                    type: ContentTypeDiscovery.identifyContentTypeFromFileName(pathRelativeToPackageRoot)
                });
                fetchCallback(blob);
            }, onerror);
        };
    };

    return PlainResourceFetcher;
});
