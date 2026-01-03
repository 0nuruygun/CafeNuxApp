(function ($) {
    "use strict";


    // Counter Number
    $('.count').each(function () {
        $(this).prop('Counter', 0).animate({
            Counter: $(this).text()
        }, {
            duration: 3000,
            easing: 'swing',
            step: function (now) {
                $(this).text(Math.ceil(now));
            }
        });
    });


    //Haftalık Doluluk Oranı
    var ctx = document.getElementById("widgetChart2");
    ctx.height = 150;
    var x = []
    var y = []

    datas[0].forEach(item => {
        x.push(item.Day)
        y.push(item.Counter)
    });
    var myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: x,
            type: 'line',
            datasets: [{
                data: y,
                label: 'Sipariş',
                backgroundColor: 'transparent',
                borderColor: 'rgba(255,255,255,.55)',
            },]
        },
        options: {

            maintainAspectRatio: false,
            legend: {
                display: false
            },
            responsive: true,
            scales: {
                xAxes: [{
                    gridLines: {
                        color: 'transparent',
                        zeroLineColor: 'transparent'
                    },
                    ticks: {
                        fontSize: 2,
                        fontColor: 'transparent'
                    }
                }],
                yAxes: [{
                    display: false,
                    ticks: {
                        display: false,
                    }
                }]
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
    });

    //En Yoğun Saatler
    var ctx = document.getElementById("widgetChart1");
    ctx.height = 150;
    x = []
    y = []
    datas[1].forEach(item => {
        x.push(item.Time)
        y.push(item.OrderCount)
    });
    var myChart = new Chart(ctx, {


        type: 'line',
        data: {
            labels: x,
            type: 'line',
            datasets: [{
                data: y,
                label: 'Sipariş',
                backgroundColor: '#63c2de',
                borderColor: 'rgba(255,255,255,.55)',
            },]
        },
        options: {

            maintainAspectRatio: false,
            legend: {
                display: false
            },
            responsive: true,
            scales: {
                xAxes: [{
                    gridLines: {
                        color: 'transparent',
                        zeroLineColor: 'transparent'
                    },
                    ticks: {
                        fontSize: 2,
                        fontColor: 'transparent'
                    }
                }],
                yAxes: [{
                    display: false,
                    ticks: {
                        display: false,
                    }
                }]
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
    });


    //WidgetChart 3
    var ctx = document.getElementById("widgetChart3");
    ctx.height = 70;
    x = []
    y = []
    datas[2].forEach(item => {
        x.push(item.Date)
        y.push(item.Count)
    });
    var myChart = new Chart(ctx, {


        type: 'line',
        data: {
            labels: x,
            type: 'line',
            datasets: [{
                data: y,
                label: 'Rezervasyon',
                backgroundColor: '#ffc107',
                borderColor: 'rgba(255,255,255,.55)',
            },]
        },
        options: {

            maintainAspectRatio: false,
            legend: {
                display: false
            },
            responsive: true,
            scales: {
                xAxes: [{
                    gridLines: {
                        color: 'transparent',
                        zeroLineColor: 'transparent'
                    },
                    ticks: {
                        fontSize: 2,
                        fontColor: 'transparent'
                    }
                }],
                yAxes: [{
                    display: false,
                    ticks: {
                        display: false,
                    }
                }]
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
    });


    //WidgetChart 4
    var ctx = document.getElementById("widgetChart4");
    ctx.height = 70;
    x = []
    y = []
    datas[3].forEach(item => {
        x.push(item.Day)
        y.push(item.Counter)
    });
    var myChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: x,
            datasets: [
                {
                    label: "Online Sipariş",
                    data: y,
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
                yAxes: [{
                    display: false
                }]
            }
        }
    });



})(jQuery);

//bar chart
var ctx = document.getElementById("barChart");
ctx.height = 315;
x = []
y = []
z = []
datas[4].forEach(item => {
    x.push(item.DayOfWeek)
    y.push(item.TotalRevenue)
    z.push(item.TotalProfit)
});
var myChart = new Chart(ctx, {
    type: 'bar',
    data: {
        labels: x,
        datasets: [
            {
                label: "Ciro",
                data: y,
                borderColor: "rgba(0, 123, 255, 0.9)",
                borderWidth: "0",
                backgroundColor: "rgba(0, 123, 255, 0.5)"
            },
            {
                label: "Kar",
                data: z,
                borderColor: "rgba(0,0,0,0.09)",
                borderWidth: "0",
                backgroundColor: "rgba(0,0,0,0.07)"
            }
        ]
    },
    options: {
        scales: {
            yAxes: [{
                ticks: {
                    beginAtZero: true
                }
            }]
        }
    }
});

//pie chart
var ctx = document.getElementById( "pieChart" );
ctx.height = 300;

x = []
y = []
z = []
datas[5].forEach(item => {
    x.push(item.label)
    y.push(item.data)
    z.push(item.color)
});

var myChart = new Chart( ctx, {
    type: 'pie',
    data: {
        datasets: [ {
            data: y,
            backgroundColor: z,
            hoverBackgroundColor: [
                                "#1e9ecd",
                                "#e67474",
                                "#bb8f0d"
                            ]

                        } ],
        labels: x
    },
    options: {
        responsive: true
    }
} );
