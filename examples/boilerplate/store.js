'use strict';
//runInAction // https://www.youtube.com/watch?v=uAlxod75FIM
const { observable, observe, autorun, computed, runInAction } = mobx;

/*
class Todo {
//  id = Math.random();
  @observable title;
  @observable finished = false;
  @computed get unfinishedTodoCount() {
    return this.finished;
  }
  constructor(title) {
    this.title = title;
  }
}*/

var todoStore = observable({
  /* some observable state */
  todos: [],

  /* a derived value */
  get completedCount() {
    return this.todos.filter((todo) => todo.completed).length;
  },
});

/* a function that observes the state */
autorun(function () {
  console.log(
    'Completed %d of %d items',
    todoStore.completedCount,
    todoStore.todos.length
  );
});

/* ..and some actions that modify the state */
todoStore.todos[0] = {
  title: 'Take a walk',
  completed: false,
};
// -> synchronously prints 'Completed 0 of 1 items'

todoStore.todos[0].completed = true;
// -> synchronously prints 'Completed 1 of 1 items'

(() => {
  const appState = observable({
    get fullName() {
      console.count('fullName');
      return this.firstName + ' ' + this.lastName;
    },
    firstName: 'Matt',
    lastName: 'Ruby',
    form: '',
    top: 0,
    devices: ['d1', 'd2'],
    age: 34,
    temperature: 80,
    todos: [
      { title: 'foo', done: false },
      { title: 'bar', done: true },
    ],
    get completedCount() {
      console.count('completedCount');
      return this.todos.filter((todo) => todo.done).length;
    },
  });
  /*
const appState = new class appState{
  @observable firstName = 'Matt'
  @observable lastName = 'Ruby'
  @observable top =0
  @observable devices =["d1","d2"]
  @observable age = 34
  @observable temperature=80
  @observable todos=[
    {  title:"foo", done: false  },
    {  title:"bar", done: true  },
  ],
  @computed get completedCount() {
    console.count('completedCount');
      return this.todos.filter(todo => todo.done).length;
  }

}*/

  window.appState = appState;
})();
