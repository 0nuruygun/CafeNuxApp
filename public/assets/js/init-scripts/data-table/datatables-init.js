(function ($) {
    "use strict";

    $("#bootstrap-data-table-export").DataTable({
        //lengthMenu: [
        //    [10, 25, 50, -1],
        //    [10, 25, 50, "All"],
        //],
        buttons: ["copy", "csv", "excel", "pdf", /* "print" */],
    });
    
})(jQuery);
