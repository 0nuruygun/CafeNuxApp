let datas = JSON.parse('<%= data%>'.replaceAll('&#34;','"')) 

( function ( $ ) {
    "use strict";


    // Counter Number
    $('.count').each(function () {
        $(this).prop('Counter',0).animate({
            Counter: $(this).text()
        }, {
            duration: 3000,
            easing: 'swing',
            step: function (now) {
                $(this).text(Math.ceil(now));
            }
        });
    });

    //WidgetChart 1
    var ctx = document.getElementById( "widgetChart1" );
    ctx.height = 150;
    var myChart = new Chart( ctx, {
        type: 'line',
        data: {
            labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July'],
            type: 'line',
            datasets: [ {
                data: [65, 59, 84, 84, 51, 55, 40],
                label: 'Dataset',
                backgroundColor: 'transparent',
                borderColor: 'rgba(255,255,255,.55)',
            }, ]
        },
        options: {

            maintainAspectRatio: false,
            legend: {
                display: false
            },
            responsive: true,
            scales: {
                xAxes: [ {
                    gridLines: {
                        color: 'transparent',
                        zeroLineColor: 'transparent'
                    },
                    ticks: {
                        fontSize: 2,
                        fontColor: 'transparent'
                    }
                } ],
                yAxes: [ {
                    display:false,
                    ticks: {
                        display: false,
                    }
                } ]
            },
            title: {
                display: false,
            },
            elements: {
                line: {
                    borderWidth: 1
                },
                point: {
                    radius: 4,
                    hitRadius: 10,
                    hoverRadius: 4
                }
            }
        }
    } );


    //WidgetChart 2
    var ctx = document.getElementById( "widgetChart2" );
    ctx.height = 150;
    var myChart = new Chart( ctx, {
        type: 'line',
        data: {
            labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July'],
            type: 'line',
            datasets: [ {
                data: [1, 18, 9, 17, 34, 22, 11],
                label: 'Dataset',
                backgroundColor: '#63c2de',
                borderColor: 'rgba(255,255,255,.55)',
            }, ]
        },
        options: {

            maintainAspectRatio: false,
            legend: {
                display: false
            },
            responsive: true,
            scales: {
                xAxes: [ {
                    gridLines: {
                        color: 'transparent',
                        zeroLineColor: 'transparent'
                    },
                    ticks: {
                        fontSize: 2,
                        fontColor: 'transparent'
                    }
                } ],
                yAxes: [ {
                    display:false,
                    ticks: {
                        display: false,
                    }
                } ]
            },
            title: {
                display: false,
            },
            elements: {
                line: {
                    tension: 0.00001,
                    borderWidth: 1
                },
                point: {
                    radius: 4,
                    hitRadius: 10,
                    hoverRadius: 4
                }
            }
        }
    } );



    //WidgetChart 3
    var ctx = document.getElementById( "widgetChart3" );
    ctx.height = 70;
    var myChart = new Chart( ctx, {
        type: 'line',
        data: {
            labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July'],
            type: 'line',
            datasets: [ {
                data: [78, 81, 80, 45, 34, 12, 40],
                label: 'Dataset',
                backgroundColor: 'rgba(255,255,255,.2)',
                borderColor: 'rgba(255,255,255,.55)',
            }, ]
        },
        options: {

            maintainAspectRatio: true,
            legend: {
                display: false
            },
            responsive: true,
            scales: {
                xAxes: [ {
                    gridLines: {
                        color: 'transparent',
                        zeroLineColor: 'transparent'
                    },
                    ticks: {
                        fontSize: 2,
                        fontColor: 'transparent'
                    }
                } ],
                yAxes: [ {
                    display:false,
                    ticks: {
                        display: false,
                    }
                } ]
            },
            title: {
                display: false,
            },
            elements: {
                line: {
                    borderWidth: 2
                },
                point: {
                    radius: 0,
                    hitRadius: 10,
                    hoverRadius: 4
                }
            }
        }
    } );


    //WidgetChart 4
    var ctx = document.getElementById( "widgetChart4" );
    ctx.height = 70;
    var myChart = new Chart( ctx, {
        type: 'bar',
        data: {
            labels: ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
            datasets: [
                {
                    label: "My First dataset",
                    data: [78, 81, 80, 45, 34, 12, 40, 75, 34, 89, 32, 68, 54, 72, 18, 98],
                    borderColor: "rgba(0, 123, 255, 0.9)",
                    //borderWidth: "0",
                    backgroundColor: "rgba(255,255,255,.3)"
                }
            ]
        },
        options: {
              maintainAspectRatio: true,
              legend: {
                display: false
            },
            scales: {
                xAxes: [{
                  display: false,
                  categoryPercentage: 1,
                  barPercentage: 0.5
                }],
                yAxes: [ {
                    display: false
                } ]
            }
        }
    } );



} )( jQuery );

 //bar chart
 var ctx = document.getElementById( "barChart" );
 //    ctx.height = 200;
 var myChart = new Chart( ctx, {
     type: 'bar',
     data: {
         labels: [ "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar" ],
         datasets: [
             {
                 label: "Ciro",
                 data: [ 65, 59, 80, 81, 86, 55, 90 ],
                 borderColor: "rgba(0, 123, 255, 0.9)",
                 borderWidth: "0",
                 backgroundColor: "rgba(0, 123, 255, 0.5)"
                         },
             {
                 label: "Kar",
                 data: [ 28, 48, 40, 19, 56, 27, 40 ],
                 borderColor: "rgba(0,0,0,0.09)",
                 borderWidth: "0",
                 backgroundColor: "rgba(0,0,0,0.07)"
                         }
                     ]
     },
     options: {
         scales: {
             yAxes: [ {
                 ticks: {
                     beginAtZero: true
                 }
                             } ]
         }
     }
 } );


(function($){

    "use strict"; // Start of use strict
   
    var SufeeAdmin = {
   
       pieFlot: function(){
   
           var data = [
               {
                   label: "Açık",
                   data: 7,
                   color: "#20a8d8"
               },
               {
                   label: "Rezerve",
                   data: 3,
                   color: "#ffc107"
               },
               {
                   label: "Kapalı",
                   data: 9,
                   color: "#f86c6b"
               }
           ];
   
           var plotObj = $.plot( $( "#flot-pie" ), data, {
               series: {
                   pie: {
                       show: true,
                       radius: 1,
                       label: {
                           show: false,
   
                       }
                   }
               },
               grid: {
                   hoverable: true
               },
               tooltip: {
                   show: true,
                   content: "%p.0%, %s, n=%n", // show percentages, rounding to 2 decimal places
                   shifts: {
                       x: 20,
                       y: 0
                   },
                   defaultTheme: false
               }
           } );
       },
   
   
   };
   
   $(document).ready(function() {
   
       SufeeAdmin.pieFlot();
   
   
   });
   
   })(jQuery);
   