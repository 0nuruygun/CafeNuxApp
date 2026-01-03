// $.noConflict();

jQuery(document).ready(function($) {

	"use strict";

	[].slice.call( document.querySelectorAll( 'select.cs-select' ) ).forEach( function(el) {
		new SelectFx(el);
	} );

	jQuery('.selectpicker').selectpicker;


	$('#menuToggle').on('click', function(event) {
		$('body').toggleClass('open');
	});

	$('.search-trigger').on('click', function(event) {
		event.preventDefault();
		event.stopPropagation();
		$('.search-trigger').parent('.header-left').addClass('open');
	});

	$('.search-close').on('click', function(event) {
		event.preventDefault();
		event.stopPropagation();
		$('.search-trigger').parent('.header-left').removeClass('open');
	});

	$('.user-area> a').on('click', function(event) {
		event.preventDefault();
		event.stopPropagation();
		$('.user-menu').parent().removeClass('open');
		$('.user-menu').parent().toggleClass('open');
	});


});

function showPage() {
	document.getElementById("loader").style.display = "none";
	document.getElementById("right-panel").style.display = "revert-layer";
	//if($("#example").length != 0){
//
	//	$('#example').DataTable({
	//		order: [ 0, 'desc' ],
	//		searching: true,
	//		ordering: true,
	//		pagination: true,
	//		info: false,
	//		paging: false,
	//		scrollCollapse: true,			
	//	});
	//}
}


$('#rezSave').on("click", ()=>{

	rezName = $('#name').val();
	rezPhone = $('#phone').val();
	rezDate = $('#rezDate').html();
	rezTable = tableId;

	if(rezName && rezPhone.length === 19 && rezDate){
		$.ajax({
			url: "/Reservation",
			type: "POST",
			data: { rezName,
					rezPhone,
					rezDate,
					rezTable
			},
			success: function (result) {
				Swal.fire({
					position: "top-end",
					icon: "success",
					title: "Rezervasyon Yapıldı",
					showConfirmButton: false,
					timer: 1500,
				});
				$("#datepicker").modal("hide");
			},
			error: function (error) {
				Swal.fire({
					position: "top-end",
					icon: "error",
					title: error.title,
					text: error.text
				});
			},
		});
	}
	else {
		Swal.fire({
			icon: "error",
			title: "Bilgi Girişi Hatası",
			text: "Lütfen Rezervasyon için gerekli bilgileri eksiksiz giriniz !"
		});
	}
	
})