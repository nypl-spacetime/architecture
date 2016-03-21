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
  if (gitHubAuth.user && gitHubAuth.key) {
    return request
      .header('Authorization', makeAuth(gitHubAuth.user, gitHubAuth.key))
  } else {
    return request
  }
}

function createBadge (svg, b, json) {
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

function getItem (key) {
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

function setItem (key, data) {
  var timestamp = Date.now()

  var str = JSON.stringify({
    timestamp: timestamp,
    data: data
  })

  localStorage.setItem(key, str)
}

function fragmentFromString(htmlStr) {
  return document.createRange().createContextualFragment(htmlStr);
}

function makeAbsolute(baseUrl, url) {
  var currentUrl = window.location.href.replace(window.location.hash, '')
  if (url.startsWith(currentUrl)) {
    return url.replace(currentUrl, baseUrl)
  }
  return url
}

function fixRelativeLinks(href, html) {
  if (html) {
    var baseUrl = href.replace('https://github.com', 'https://raw.githubusercontent.com') + '/master/'

    var srcs = html.querySelectorAll('*[src]')
    for (var i = 0; i < srcs.length; ++i) {
      srcs[i].src = makeAbsolute(baseUrl, srcs[i].src)
    }

    var hrefs = html.querySelectorAll('*[href]')
    for (var i = 0; i < hrefs.length; ++i) {
      hrefs[i].href = makeAbsolute(baseUrl, hrefs[i].href)
    }
  }
  return html
}

function getReadmeMarkdown(href, callback) {
  var apiUrl = href.replace('https://github.com/', 'https://api.github.com/repos/') + '/readme'
  var htmlStr = getItem(apiUrl)

  if (htmlStr) {
    callback(null, fixRelativeLinks(href, fragmentFromString(htmlStr)))
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
        callback(err, fixRelativeLinks(href, html))
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
      if (html) {
        d3.select('#popup')
          .classed('hidden', false)
          .style('left', point.x + 'px')
          .style('top', point.y + 'px')

        document.getElementById('popup-contents').scrollTop = 0

        var popup = document.getElementById('popup-contents')

        // Set href of README link
        document.querySelector('#popup-link a').href = href

        // Clear previous contents
        while (popup.firstChild) {
          popup.removeChild(popup.firstChild);
        }

        // Add contents as child of popup element
        popup.appendChild(html.firstChild.firstChild)
      } else {
        d3.select('#popup')
          .classed('hidden', true)
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

  var svgPos = cumulativeOffset(archElement)

  var popup = document.querySelector('#popup')
  var popupStyle = getComputedStyle(popup)
  var popupWidth = parseInt(popupStyle.width.replace('px', ''))

  var svgStyle = getComputedStyle(svgDoc)
  var svgMarginLeft = parseInt(svgStyle.marginLeft.replace('px', ''))

  var location = {
    x: (matrix.a * x) + (matrix.c * y) + svgMarginLeft - Math.round(popupWidth / 2),
    y: (matrix.b * x) + (matrix.d * y) + svgPos.top - 25
  }

  return location
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
