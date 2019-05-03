start();

function start(){
  d3.json("africa_map.geo.json")
    .then(
      function(data){
        graph(data);
    },
      function(err){
        console.log(err);
    });
}

function graph(data){
  var height = 500;
  var width = 500;

  var svg = d3.select("svg")
              .attr("height",height)
              .attr("width",width);

  var projection = d3.geoBromley()
                     .translate([width/3,height/2])
                     .scale([350]);

  var geoMagic = d3.geoPath(projection);

  var knuck = d3.drag().on('drag',dragon);
  var truck = d3.zoom().on("zoom",zuma);
  function dragon(d){
      var head = projection.translate();
      head[0]+=d3.event.dx;
      head[1]+=d3.event.dy;
      projection.translate(head);
      svg.selectAll("path").attr("d",geoMagic);
  }

  function zuma(d){
    var tail = [d3.event.transform.x,d3.event.transform.y];
    var scala = d3.event.transform.k*2000;
    projection.translate(tail).scale(scala);
    svg.selectAll("path").attr("d",geoMagic);
  }

  var countries = svg.append("g")
                     .attr("id","pathHolder")
                     .call(truck)
                     .call(truck.transform,
                     d3.zoomIdentity
                       .translate(width/2,height/2)
                       .scale(.18)
                       .translate(-390,50));

  countries.selectAll("path")
          .data(data.features)
          .enter()
          .append("path")
          .attr("d",geoMagic)
          .attr("stroke","black")
          .attr("fill","none");

   countries.append("rect")
            .attr("x",0)
            .attr("y",0)
            .attr("width",width)
            .attr("height",height)
            .attr("opacity",0)
            .attr("fill","white");

  // var dirns = svg.selectAll("g#new")
  //                .data(["north","south","east","west"])
  //                .enter()
  //                .append("g")
  //                .attr("class","pan")
  //                .attr("id",function(d){return d;});
  //
  // dirns.append("rect")
  //      .attr("x",function(d,i){
  //        if(i==2){return width-20;} return 0;
  //      })
  //      .attr("y",function(d,i){
  //        if(i==1){return height-20;}
  //        else if(i>1){return 20;} return 0;
  //      })
  //      .attr("width",function(d,i){
  //        if(i<2){return width;} return 20;
  //      })
  //      .attr("height",function(d,i){
  //        if(i<2){return 20;} return height-40;
  //      });
  // var dicto = {0:"&uarr;",1:"&darr;",2:"&rarr;",3:"&larr;"}
  // dirns.append("text")
  //      .attr("x",function(d,i){
  //        if(i<2){return width/2;} return ((i+1)%2)*(width-20)+5;
  //      })
  //      .attr("y",function(d,i){
  //        if(i<2){return (i%2)*(height-20)+15;} return height/2;
  //      })
  //      .html(function(d,i){return dicto[i]});
  // d3.selectAll(".pan")
  //   .on("click",function(){
  //     var off = projection.translate();
  //     var move = 40;
  //     var dirn = d3.select(this).attr("id");
  //     switch(dirn){
  //       case "north":
  //         off[1]+=move;
  //         break;
  //       case "south":
  //         off[1]-=move;
  //         break;
  //       case "east":
  //         off[0]-=move;
  //         break;
  //       case "west":
  //         off[0]+=move;
  //         break;
  //     }
  //     projection.translate(off);
  //     svg.selectAll("path")
  //        .transition()
  //        .attr("d",geoMagic);
  //   })

}

function temperatureByYearByCountry(){
  d3.csv("ClimateAndCodes.csv")
    .then(
      function(d){
        var tempData = [];
        var precipData = [];
        d.forEach(function(piece){
          if(piece.Code!="SSD"){
            tempData.push(d3.json("http://climatedataapi.worldbank.org/climateweb/rest/v1/country/mavg/tas/1980/1999/"+piece.Code));
            precipData.push(d3.json("http://climatedataapi.worldbank.org/climateweb/rest/v1/country/mavg/pr/1980/1999/"+piece.Code));
          }
        });
        Promise.all(precipData.concat(tempData))
               .then(
                 function(megaData){
                  console.log(megaData);
                 },
                 function(err2){
                   console.log(err2);
                 }
               )
    },
      function(err){
        console.log(err);
      })
}
