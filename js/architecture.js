var ghUser = 'bert.spaan@gmail.com'
var ghKey = '4b40031d5b922940b806039214d6934a39584fa6'

// localStorage TTL for GitHub API results
var ttl = 60 * 60 * 1000

var colors = {
  unfinished: '#ed2c25',
  finished: '#80c626',
  progressStart: '#ff6a1f',
  progressEnd: '#ffe91e'
}

// SVG min and max width
var widths = [
  1200,
  1600
]

var colorScale = d3.scale.linear()
  .domain([0, 1])
  .range([colors.progressStart, colors.progressEnd])
  .interpolate(d3.interpolateHsl)

function getColor(p) {
  var color = colors.unfinished

  if (p > 0.05) {
    if (p >= 0.95) {
      color = colors.finished
    } else {
      color = colorScale(p)
    }
  }

  return color
}

function createBadge(b, json) {
  if (json && json.open_issues_count) {
    var bbox = b.getBBox()

    var radius = 18

    d3.select(b).append('circle')
      .attr('cx', bbox.x + bbox.width)
      .attr('cy', bbox.y)
      .attr('r', radius)
      .style('fill', '#f50000')
      .style('stroke-width', '3')
      .style('stroke', 'rgba(255, 255, 255, 0.5)')

    d3.select(b).append('text')
      .attr('font-family', 'Open Sans')
      .attr('font-size', 21)
      .attr('font-weight', 500)
      .attr('text-anchor', 'middle')
      .style('fill', 'white')
      .attr('transform', 'translate(' + Math.round(bbox.x + bbox.width) + ' ' + Math.round(bbox.y + radius / 2 - 1) + ')')
      .html(json.open_issues_count)
  }
}

function getItem(key) {
  try {
    var str = localStorage.getItem(key)
    var obj = JSON.parse(str)

    var timestamp = Date.now()

    if (obj.timestamp > 0 && obj.timestamp + ttl > timestamp) {
      return obj.data
    } else {
      return null
    }
  } catch (e) {
    return null
  }
}

function setItem(key, data) {
  var timestamp = Date.now();

  var str = JSON.stringify({
    timestamp: timestamp,
    data: data
  })

  localStorage.setItem(key, str)
}

d3.json('data.json', function(err, data) {
  d3.xml('architecture.svg', function(err, doc) {
    var svg = doc.querySelector('svg')

    // Set SVG height & width
    svg.removeAttribute('height', null)
    svg.setAttribute('width', '100%')
    svg.style.minWidth = widths[0] + 'px'
    svg.style.maxWidth = widths[1] + 'px'

    // Append SVG document to HTML
    document.getElementById('architecture').appendChild(doc.documentElement)

    var linkBlocks = document.querySelectorAll('svg a')
    Array.prototype.forEach.call(linkBlocks, function(b) {
      var href = b.getAttribute('xl:href')

      var done = data[href]

      b.onclick = function () {
        console.log('Show README:', href + '/README.md')
        return false
      };

      if (done !== undefined) {
        b.setAttribute('fill', getColor(done))
      } else {
        console.log('Link not found in data.json:', href)
      }

      if (href && href.startsWith('https://github.com/')) {
        var results = getItem(href)

        if (results) {
          createBadge(b, results)
        } else {
          var apiUrl = href.replace('https://github.com/', 'https://api.github.com/repos/')

          function makeAuth(user, password) {
            var tok = user + ':' + password
            var hash = btoa(tok)
            return 'Basic ' + hash
          }

          d3.json(apiUrl)
            .header('Authorization', makeAuth(ghUser, ghKey))
            .get(function(err, json) {
              if (err) {
                setItem(href, {open_issues_count: 0})
              } else {
                setItem(href, json)
                createBadge(b, json)
              }
            })
        }
      }
    })

    // Set legend colors
    var legendItems = document.querySelectorAll('rect[fill="#ff9cf8"]')
    Array.prototype.forEach.call(legendItems, function(e, i) {
      var p = (i / (legendItems.length - 1))

      e.style.fill = getColor(p)
    })

    // Remove all elements with white background (just leaving the outline)
    var whiteElements = document.querySelectorAll('[fill="white"]')
    Array.prototype.forEach.call(whiteElements, function(e) {
      e.parentNode.removeChild(e)
    })

    // Remove title elements, they cause annoying mouse tooltips
    var titles = document.querySelectorAll('title')
    Array.prototype.forEach.call(titles, function(e) {
      e.parentNode.removeChild(e)
    })
  })
})
