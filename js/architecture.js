// localStorage TTL for GitHub API results
var ttl = 60 * 60 * 1000

var currentPopupHref

var legendColorsCount = 5
var legendColorClass = 'finished-color'
function getColor(p) {
  var step = 1 / (legendColorsCount - 2)

  if (p < 0.001) {
    return legendColorClass + '1'
  } else if (p > 0.999) {
    return legendColorClass + legendColorsCount
  } else {
    return legendColorClass + (Math.floor(p / step) + 2)
  }
}

function makeAuth(user, password) {
  var tok = user + ':' + password
  var hash = btoa(tok)
  return 'Basic ' + hash
}

function addGitHubAuth(request) {
  return request
    .header('Authorization', makeAuth(gitHubAuth.user, gitHubAuth.key))
}

function createBadge(svg, b, json) {
  if (json && json.open_issues_count) {
    var bbox = b.getBBox()

    var radius = 18

    var badge = d3.select(svg).append('g')
      .attr('class', 'badge')

    badge.append('circle')
      .attr('cx', bbox.x + bbox.width)
      .attr('cy', bbox.y)
      .attr('r', radius)

    badge.append('text')
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

document.addEventListener('click', function () {
  hidePopup()
})

function setItem(key, data) {
  var timestamp = Date.now();

  var str = JSON.stringify({
    timestamp: timestamp,
    data: data
  })

  localStorage.setItem(key, str)
}

function fragmentFromString(htmlStr) {
  return document.createRange().createContextualFragment(htmlStr);
}

function getReadmeMarkdown(href, callback) {
  var apiUrl = href.replace('https://github.com/', 'https://api.github.com/repos/') + '/readme'
  var htmlStr = getItem(apiUrl)

  if (htmlStr) {
    callback(null, fragmentFromString(htmlStr))
  } else {
    addGitHubAuth(d3.html(apiUrl))
      .header('Accept', 'application/vnd.github.VERSION.html')
      .get(function(err, html) {
        if (err) {
          setItem(apiUrl, '')
        } else {
          var htmlStr = new XMLSerializer().serializeToString(html);
          setItem(apiUrl, htmlStr)
        }
        callback(err, html)
      })
  }
}

var popupBaseUrls = [
  {
    baseUrl: 'https://github.com/',
    getContents: getReadmeMarkdown
  }
]

function hidePopup() {
  d3.select('#popup')
    .classed('hidden', true)
}

function createPopup(href, point) {
  var getContents

  for (var i = 0; i < popupBaseUrls.length; i++) {
    if (href.startsWith(popupBaseUrls[i].baseUrl)) {
      getContents = popupBaseUrls[i].getContents
      break;
    }
  }

  if (getContents) {
    getContents(href, function(err, html) {
      d3.select('#popup')
        .classed('hidden', false)
        .style('left', point.x + 'px')
        .style('top', point.y + 'px')

      var popup = document.getElementById('popup')

      // Clear previous contents
      while (popup.firstChild) {
        popup.removeChild(popup.firstChild);
      }

      var childNodes = html.firstChild.firstChild.childNodes;
      for (var i = 0, len = childNodes.length; i < Math.min(len, 4); i++) {
        popup.appendChild(childNodes[i]);
      }

    })
  } else {
    d3.select('#popup')
      .classed('hidden', true)
  }
}

function cumulativeOffset (element) {
  var top = 0
  var left = 0
  do {
    top += element.offsetTop  || 0
    left += element.offsetLeft || 0
    element = element.offsetParent;
  } while (element);

  return {
    top: top,
    left: left
  }
}

function getPopupLocation (archElement, svgDoc, element) {
  var matrix = element.getScreenCTM()
  var bbox = element.getBBox()

  var x = Math.round(bbox.x + (bbox.width / 2))
  var y = (bbox.y + bbox.height)

  // d3.select('#popup')

  var svgPos = cumulativeOffset(archElement)
  // console.log(svgDoc.offsetLeft, svgDoc.scrollLeft)

  // console.log(svgPos)
  // console.log(bbox)

  var chips = {
    x: (matrix.a * x) + (matrix.c * y) - 310 - 300,
    y: (matrix.b * x) + (matrix.d * y) + svgPos.top
  }
  return chips
}

d3.json('data.json', function(err, data) {
  d3.xml('architecture.svg', function(err, doc) {
    var svg = doc.querySelector('svg')

    // Set SVG height & width
    svg.removeAttribute('height', null)

    // Append SVG document to HTML
    var archElement = document.getElementById('architecture')

    archElement.appendChild(doc.documentElement)

    var linkBlocks = document.querySelectorAll('svg a')
    Array.prototype.forEach.call(linkBlocks, function(b) {
      var href = b.getAttribute('xl:href')

      var done = data[href]

      b.onclick = function (e) {
        e.stopPropagation()
        e.preventDefault()

        // TODO: finish popup positioning!
        return

        var popupShown = !d3.select('#popup')
          .classed('hidden')

        if (currentPopupHref !== href || !popupShown) {
          createPopup(href, getPopupLocation(archElement, svg, this))
        } else {
          hidePopup()
        }
        currentPopupHref = href
      };

      if (done !== undefined) {
        b.setAttribute('class', getColor(done))
      } else {
        console.error('Link not found in data.json:', href)
        b.setAttribute('class', 'finished-error')
      }

      if (href && href.startsWith('https://github.com/')) {
        var results = getItem(href)

        if (results) {
          createBadge(svg, b, results)
        } else {
          var apiUrl = href.replace('https://github.com/', 'https://api.github.com/repos/')

          addGitHubAuth(d3.json(apiUrl)).get(function(err, json) {
            if (err) {
              setItem(href, {open_issues_count: 0})
            } else {
              setItem(href, json)
              createBadge(svg, b, json)
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
