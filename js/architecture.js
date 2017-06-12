var namespaces = {
  gh: 'https://github.com/'
}

var config = {
  element: 'path',
  getHref: function (link) {
    return link.getAttribute('xl:href')
  },
  getStyle: function (href, link) {
    return {
      fill: 'rgba(255, 255, 255, 0)',
      // stroke: '#ef5526',
      strokeWidth: '2px'
    }
  },
  getPopupContents: function (href, link) {
    if (href.indexOf(namespaces.gh) >= 0) {
      return iA.gitHub.getReadme(href)
    }
  }
}

var datasetsConfig = Object.assign({}, config, {
  element: 'ellipse',
  getHref: function (link) {
    return link.getAttribute('xlink:href')
  }
})

iA.architecture.create('#architecture', 'architecture.svg', config)
iA.architecture.create('#datasets', datasetsUrl, datasetsConfig, function () {
  var datasetsContainer = document.getElementById('datasets')
  var datasetsSvg = document.querySelector('#datasets svg')
  console.log(datasetsSvg.clientWidth / 2, datasetsContainer.clientWidth / 2)
  datasetsContainer.scrollLeft = datasetsSvg.clientWidth / 2 - datasetsContainer.clientWidth / 2
})
