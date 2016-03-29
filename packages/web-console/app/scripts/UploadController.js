/*******************************************************************************
 *  _  _ ___ ___     _ _
 * | \| | __/ __| __| | |__
 * | .` | _|\__ \/ _` | '_ \
 * |_|\_|_| |___/\__,_|_.__/
 *
 * Copyright (c) 2014-2016. The NFSdb project and its contributors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 ******************************************************************************/

/*globals $:false */
/*globals jQuery:false */
/*globals nfsdb:false */

/**
 * @return {string}
 */
function s4() {
    'use strict';
    return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
}

function guid() {
    'use strict';
    return (s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4());
}

function numberWithCommas(x) {
    'use strict';

    var parts = x.toString().split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
}

function nopropagation(e) {
    'use strict';

    e.stopPropagation();
    if (e.preventDefault) {
        e.preventDefault();
    }
}

(function ($) {
    'use strict';

    function UploadController(div) {
        var dict = {};
        var container = div;
        var canvas;
        var top = 0;
        var uploadQueue = [];
        var uploaded = null;

        function init() {
            container.append('<div class="ud-header-row"><div class="ud-header ud-h0">File name</div><div class="ud-header ud-h1">Size</div><div class="ud-header ud-h2">Status</div></div>');
            container.append('<div class="ud-canvas"></div>');
            canvas = container.find('> .ud-canvas');
        }

        function toggleRow() {
            var id = $(this).parent().parent().attr('id');
            var btn = $('#' + id).find('.fa');
            var e = dict[id];

            e.selected = !e.selected;

            if (e.selected) {
                btn.removeClass('fa-square-o');
                btn.addClass('fa-check-square-o');
            } else {
                btn.removeClass('fa-check-square-o');
                btn.addClass('fa-square-o');
            }
        }

        function showDetail(e) {
            var id = $(this).parent().attr('id');
            console.log('showing ' + id);
            $('#upload-detail').html(dict[id].response);
            nopropagation(e);
        }

        function render(e) {
            canvas.append('<div id="' + e.id + '" class="ud-row" style="top: ' + top + 'px;"><div class="ud-cell ud-c0"><i class="fa fa-square-o">&nbsp;&nbsp;</i>' + e.name + '</div><div class="ud-cell ud-c1">' + e.size + '</div><div class="ud-cell ud-c2"><span class="label">pending</span></div></div>');
            var row = $('#' + e.id);
            row.find('.fa').click(toggleRow);
            row.find('.ud-c0').click(showDetail);
            top += 35;
        }

        function updateProgress(event) {
            if (event.lengthComputable) {
                var pos = event.loaded || event.position;
                $('#' + uploaded.id).find(' > .ud-progress').css('width', (pos * 100 / uploaded.size) + '%');
            }
        }

        function status(e, html, processNext) {
            var row = $('#' + e.id);
            row.find(' > .ud-c2').html(html);
            row.find(' > .ud-progress').remove();

            if (processNext) {
                var next = uploadQueue.shift();
                if (next) {
                    upload(next);
                } else {
                    uploaded = null;
                }
            }
        }

        function failure(e) {
            status(e, '<span class="label label-danger">failed</span>', true);
        }

        function setupUploadProgressCallback() {
            var xhrobj = $.ajaxSettings.xhr();
            if (xhrobj.upload) {
                xhrobj.upload.addEventListener('progress', updateProgress, false);
            }
            return xhrobj;
        }

        function success(r) {
            uploaded.response = r;
            console.log(uploaded.id);
            console.log(uploaded.response);
            status(uploaded, '<span class="label label-success">success</span>', true);
        }

        function error(xhr) {
            uploaded.response = xhr.responseText;
            failure(uploaded);
        }

        function upload(e) {

            uploaded = e;
            status(e, '<span class="label label-info">uploading</span>', false);
            $('#' + e.id).append('<div class="ud-progress"></div>');

            var fd = new FormData();
            fd.append('data', e.file);
            $.ajax({
                xhr: setupUploadProgressCallback,
                url: '/imp',
                type: 'POST',
                contentType: false,
                processData: false,
                cache: false,
                data: fd,
                success: success,
                error: error
            });
        }

        function add(files) {
            for (var i = 0; i < files.length; i++) {
                var f = files[i];
                var e = {
                    id: guid(),
                    name: f.name,
                    size: f.size,
                    file: f,
                    sizeFmt: numberWithCommas(f.size),
                    selected: false
                };
                dict[e.id] = e;
                render(e);
                if (uploaded != null) {
                    uploadQueue.push(e);
                } else {
                    upload(e);
                }
            }
        }

        init();

        return {
            'add': add
        };
    }

    $.extend(true, window, {
        nfsdb: {
            UploadController: UploadController
        }
    });

}(jQuery));

$(document).ready(function () {
    'use strict';

    var target = $('#dragTarget');
    var collection = $();
    var controller = new nfsdb.UploadController($('#upload-list'));

    function dragDrop(e) {
        // clear in-out collection for drop box
        collection = $();
        target.removeClass('drag-drop');
        target.addClass('drag-idle');
        e.preventDefault();
        controller.add(e.originalEvent.dataTransfer.files);
    }

    target.on('drop', dragDrop);

    // deal with event propagation to child elements
    // http://stackoverflow.com/questions/10867506/dragleave-of-parent-element-fires-when-dragging-over-children-elements

    $.fn.dndhover = function () {

        return this.each(function () {

            var self = $(this);

            self.on('dragenter', function (event) {
                if (collection.size() === 0) {
                    self.trigger('dndHoverStart');
                }
                collection = collection.add(event.target);
            });

            self.on('dragleave', function (event) {
                /*
                 * Firefox 3.6 fires the dragleave event on the previous element
                 * before firing dragenter on the next one so we introduce a delay
                 */
                setTimeout(function () {
                    collection = collection.not(event.target);
                    if (collection.size() === 0) {
                        self.trigger('dndHoverEnd');
                    }
                }, 1);
            });
        });
    };

    target.dndhover().on({
        'dndHoverStart': function (event) {
            target.addClass('drag-drop');
            target.removeClass('drag-idle');
            nopropagation(event);
            return false;
        },
        'dndHoverEnd': function (event) {
            target.removeClass('drag-drop');
            target.addClass('drag-idle');
            nopropagation(event);
            return false;
        }
    });

    //
    // prevent dropping files into rest of document
    //
    $(document).on('dragenter', nopropagation);
    $(document).on('dragover', nopropagation);
    $(document).on('drop', nopropagation);
});
