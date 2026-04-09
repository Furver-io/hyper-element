'use strict';
(() => {

  window.addEventListener('WebComponentsReady', function(e) {
    console.log("App ready!","imports are loaded and elements have been registered")
  });

  //=====================================================
  //============================= Example: simple element
  //=====================================================

  document.registerElement(
    'the-max',
    class extends hyperElement {
      render(Html) {
        Html`MAX:${this.props.max}`;
      }
    }
  );

  //=====================================================
  //================================= Example: using mobx
  //======================================== using a wire

  document.registerElement(
    'alex-rocks',
    class extends hyperElement {
      setup(onNext) {
        mobx.autorun(onNext(window.appState));
      }

      render(Html, { devices }) {
        const _ = Html.lite;

        Html`

        Your devices
        <ul>${devices.map((num) => _`<li>${num}</li>`)}</ul>
        <the-max max=20 />`;
      }
    }
  );

  //=====================================================
  //================================= Example: using mobx
  //========================================= with inputs

  document.registerElement(
    'test-elem',
    class extends hyperElement {
      setup(onNext) {
        mobx.autorun(onNext(window.appState));
      }

      render(Html, store) {
        const max = this.props.max || 100;

        Html`

          <h1 style=${{ color: store.temperature < max ? 'green' : 'red' }}>
               temperature: ${store.temperature}
          </h1>
          ${store.fullName} ${store.completedCount} ${store.todos.length}
          <h2>Time is ${new Date().toLocaleTimeString()}.</h2>

              <input oninput=${this.oninput}
                      value=${store.form}
                      onkeyup=${this.onkeyup}/>

          <br/>
          <alex-rocks />

      `;
      }

      onkeyup({ key }) {
        if ('Enter' === key) this.save();
      }

      save() {
        this.store.devices.push(this.store.form);
        this.store.form = '';
      }

      oninput(event) {
        this.store.form = event.target.value;
      }
    }
  );
})();
