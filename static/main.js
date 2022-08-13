const auth_main = document.getElementById('auth-main');
const auth_error = document.getElementById('auth-error');
const problem_selector_div = document.getElementById('problem-selector-div');
const requests_table_div = document.getElementById('requests-div');
const new_request_main = document.getElementById('new-request-main');
const new_request_error = document.getElementById('new-request-error');

const api_base_url = 'https://test.net/api'; // TODO: Change this to your real API URL

let state = null;

const User = {
    store: (user) => {
        sessionStorage.setItem('user', JSON.stringify(user));
    },

    get: () => {
        data_str = sessionStorage.getItem('user');
        if (data_str === null) { return null; }
        return JSON.parse(data_str);
    },

    remove: () => {
        sessionStorage.removeItem('user');
    },
}

const resetState = function() {
    state = {
        user: User.get(),
        login: {
            fetching: false,
            value: '',
            msg: ''
        },
        problem_selector: {
            selected_id: null
        },
        problems: [],
        requests: [],
        points: [],
        new_request: {
            fetching: false,
            value: '',
            msg: ''
        }
    }
}

const isLoggedIn = function() {
    return !(state['user'] === null);
}

const configureFetch = function() {
    let realFetch = window.fetch;
    window.fetch = function(url, opts) {
        const {method, headers} = opts;
        const body = opts.body && JSON.parse(opts.body);
        console.log(`${method} ${url}:\nheaders: ${JSON.stringify(headers)}\nbody: ${JSON.stringify(body)}`);

        return new Promise((resolve, reject) => {
            const handleRoute = function() {
                switch(true) {
                    case url.startsWith('https://test.net') && url.endsWith('/info') && method === 'GET':
                        return getInfo(headers['X-UM-ID']);
                    case url.startsWith('https://test.net') && url.endsWith('/requests') && method === 'POST':
                        problem_id = parseInt(url.match(/\/(\d+)\/requests/)[1]);
                        points = body['inputs']
                        return addRequest(headers['X-UM-ID'], problem_id, points)
                    default:
                        return realFetch(url, opts)
                            .then(response => resolve(response))
                            .catch(error => reject(error));
                }
            };

            const getInfo = function(user_id) {
                console.log('[getInfo]');
                return ok({
                    user: {
                        id: parseInt(user_id),
                        name: 'Chad L.'
                    },
                    problems: [
                        {
                            id: 1,
                            name: 'Test problem',
                            description: 'A fun one where you can take as many guesses as you want',
                            max_requests: 99999,
                            max_points: 9999999
                        },
                        {
                            id: 2,
                            name: 'The real deal',
                            description: 'This is the one that really counts',
                            max_requests: 3,
                            max_points: 10
                        }
                    ],
                    requests: [
                        {
                            id: 1,
                            timestamp: 1660164991,
                            problem_id: 1
                        },
                        {
                            id: 4,
                            timestamp: 1660134235,
                            problem_id: 1
                        }
                    ],
                    points: [
                        {
                            id: 1,
                            request_id: 1,
                            input: [2.353, 5.349],
                            output: -2.78
                        },
                        {
                            id: 2,
                            request_id: 1,
                            input: [-1.355, 2.542],
                            output: 1.583
                        },
                        {
                            id: 9,
                            request_id: 4,
                            input: [0.356, 7.244],
                            output: 5.5845
                        }
                    ]
                });
            };

            const addRequest = function(student_id, problem_id, points_to_add) {
                console.log('[addRequest]', student_id, problem_id, points_to_add);
                request_id = Date.now();
                timestamp = Math.floor(Date.now()/1000);
                return ok({
                    request: {
                        id: request_id,
                        timestamp: timestamp,
                        problem_id: problem_id
                    },
                    points: points_to_add.map((x, index) => {
                        return {
                            id: timestamp + index + 1,
                            request_id: request_id,
                            input: x,
                            output: 0.5*x[0]**2 - x[1]
                        };
                    })
                });
            };

            const ok = function(body) {
                resolve({
                    ok: true,
                    text: () => Promise.resolve(JSON.stringify(body)),
                    json: () => Promise.resolve(body)});
            };

            const unauthorized = function() {
                const body = {
                    error: 'Unauthorized. Enter a valid Student ID.'};
                resolve({
                    status: 401,
                    text: () => Promise.resolve(JSON.stringify(body)),
                    json: () => Promise.resolve(body)});
            };
            
            setTimeout(handleRoute, url.startsWith('https://test.net') ? 400 : 0);

        });
    };
};

const getProblemContext = function() {
    const problem_id = state['problem_selector']['selected_id'];
    if (problem_id === null) {
        return {
            'requests_remaining': 1,
            'points_remaining': 1,
            'points': []
        };
    }
    const problem = state['problems'].find(p => { return p.id == problem_id });
    const requests = state['requests'].reduce((prev, next) => {
        if (next.problem_id == problem_id) {
            prev.push(next);
        }
        return prev;
    }, []);
    request_ids = requests.map((r) => r.id)
        .sort((a, b) => a.id > b.id ? -1 : 1);
    let problem_points = state['points'].reduce((prev, next) => {
        let r = requests.find(r => r.id == next.request_id);
        if (request_ids.includes(next.request_id)) {
            prev.push({
                ...next,
                ...{timestamp: r.timestamp},
                ...{request_no: request_ids.indexOf(r.id) + 1},
                ...{point_no: prev.length + 1}
            });
        }
        return prev;
    }, []);
    problem_points.sort((a, b) => a.id > b.id ? -1 : 1);
    return {
        'requests_remaining': problem.max_requests - request_ids.length,
        'points_remaining': problem.max_points - problem_points.length,
        'points': problem_points
    }
};

const fetchInfo = function(student_id, onSuccess, onFailure) {
    console.log('[fetchInfo] student_id =', student_id);
    fetch(api_base_url + '/info', {
        method: 'GET',
        headers: {
            'X-UM-ID': student_id,
            'Accept': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            return response.json()
                .then(data => {throw new Error(data['error'])});
        }
        console.log('response =', response);
        return response.json();
    })
    .then(onSuccess)
    .catch(err => {
        console.error(err);
        onFailure(err);
    });
};

const fetchAddRequest = function(student_id, problem_id, points, onSuccess, onFailure) {
    console.log('[fetchAddRequest] ', student_id, problem_id, points);
    fetch(`${api_base_url}/problems/${problem_id}/requests`, {
        method: 'POST',
        headers: {
            'X-UM-ID': student_id,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({inputs: points})
    })
    .then(response => {
        if (!response.ok) {
            return response.json()
                .then(data => {throw new Error(data['error'])});
        }
        console.log('response =', response);
        return response.json();
    })
    .then(onSuccess)
    .catch(err => {
        console.error(err);
        onFailure(err);
    });
};

const Login = {

    doLogin: () => {
        const student_id = document.getElementById('login_input').value.trim();
        console.log('[doLogin], student_id=', student_id);
        if (!student_id.length || student_id == undefined) {
            state['login']['msg'] = 'Invalid Student ID';
            Login.renderError();
            return;
        }
        state['login']['value'] = student_id;
        state['login']['fetching'] = true;
        console.log('logging in with student id ' + student_id); 
        Login.render();
        fetchInfo(student_id, Login.onLoginSuccess, Login.onLoginFailure);
    },

    onLoginFailure: (err) => {
        state['login']['fetching'] = false;
        state['login']['msg'] = err;
        state['login']['value'] = '';
        Login.render();
    },

    onLoginSuccess: (data) => {
        console.log('[onLoginSuccess] data=', data);
        state['login']['fetching'] = false;
        state['login']['value'] = '';
        state['login']['msg'] = '';
        console.log('data =', data);
        state = {...state, ...data};
        User.store(state['user']);
        console.log('state =', state);
        App.render();
    },

    doLogout: () => {
        console.log('logging out...');
        User.remove();
        resetState();
        console.log('state =', state);
        App.render();
    },

    renderUser: () => {
        let el = document.createElement('div');
        let p = document.createElement('p');
        p.textContent = 'Logged in as ' + state['user']['name'];
        let button = document.createElement('button');
        button.textContent = 'Log out';
        button.addEventListener('click', Login.doLogout);
        el.append(p, button);
        auth_main.replaceChildren(el);
    },

    renderForm: () => {
        let el = document.createElement('div');
        let p = document.createElement('p');
        p.textContent = 'Log in with your student ID';
        let s = document.createElement('span');
        let label = document.createElement('span');
        label.textContent = 'Student ID:';
        let input = document.createElement('input');
        input.setAttribute('name', 'student_id');
        input.setAttribute('id', 'login_input');
        input.setAttribute('type', 'number');
        input.value = state['login'] ? state['login']['value'] || '' : '';
        input.disabled = state['login']['fetching'];
        let button = document.createElement('button');
        button.addEventListener('click', Login.doLogin);
        button.textContent = 'Log in';
        button.disabled = state['login']['fetching'];
        s.append(label, input, button);
        el.append(p, s);
        auth_main.replaceChildren(el);
    },

    renderError: () => {
        if (state['login']['fetching']) {
            auth_error.textContent = 'Logging in...';
            return;
        }
        auth_error.textContent = state['login']['msg'];
    },

    render: () => {
        console.log('[render] state =', JSON.stringify(state));
        if (state['user'] === null) { // not logged in
            Login.renderForm();
        } else { // logged in
            Login.renderUser();
        }
        Login.renderError();
    }
};

const ProblemSelector = {
    onChange: (e) => {
        console.log('[ProblemSelector.onChange] value =', e.target.value);
        selected_id = parseInt(e.target.value);
        state['problem_selector']['selected_id'] = (selected_id == -1) ? null : selected_id;
        RequestsTable.render();
        NewRequest.render();
    },

    render: () => {
        if (!isLoggedIn()) {
            problem_selector_div.replaceChildren();
            return;
        }
        if ((state['problem_selector']['selected_id'] === null) && state['problems'].length) {
            state['problem_selector']['selected_id'] = state['problems'][0].id;
        }
        console.log('[ProblemSelector.render]');
        let select = document.createElement('select');
        let blank_opt = document.createElement('option');
        blank_opt.setAttribute('value', -1);
        blank_opt.text = 'Select a problem';
        let opts = [];
        state['problems'].forEach((problem, index) => {
            console.log('loading problem ', problem.id);
            let new_opt = document.createElement('option');
            new_opt.setAttribute('value', problem.id);
            new_opt.text = problem.name;
            if (problem.id === state['problem_selector']['selected_id']) {
                new_opt.setAttribute('selected', true);
            }
            opts.push(new_opt);
        });
        select.append(blank_opt, ...opts);
        select.addEventListener('change', ProblemSelector.onChange);
        problem_selector_div.replaceChildren(select);
    }
};

const RequestsTable = {
    getData: () => {
        return getProblemContext();
    },

    render: () => {
        console.log('[RequestsTable.render], state =', state);
        if (!isLoggedIn() || (state['problem_selector']['selected_id'] === null)) {
            requests_table_div.replaceChildren();
            return;
        }
        problem_id = state['problem_selector']['selected_id'];
        data = RequestsTable.getData();
        console.log('data = ', data);
        let p = document.createElement('p');
        p.textContent = `You have ${data['requests_remaining']} requests remaining to query ${data['points_remaining']} points.`;
        let rows = [];
        let table = document.createElement('table');
        let tr = document.createElement('tr');
        const columns = ['timestamp', 'request_no', 'point_no', 'input', 'output'];
        columns.forEach((col, index) => {
            let th = document.createElement('th');
            th.textContent = col;
            tr.append(th);
        });
        rows.push(tr);
        data['points'].forEach((point, index) => {
            let row = document.createElement('tr');
            columns.forEach((col, j) => {
                let td = document.createElement('td');
                td.textContent = (col === 'timestamp') ? new Date(1000*point[col]).toISOString() : point[col];
                row.append(td);
            });
            rows.push(row);
        })
        table.replaceChildren(...rows);
        requests_table_div.replaceChildren(p, table);
    }
};

const NewRequest = {
    parseInput: (data) => {
        const isFloat = function(x) {
            return typeof(x) === 'number' && !Number.isNaN(x);
        };
        if (!data.trim().length) { 
            throw new Error('Invalid points. Enter your points in the textbox, one ordered-pair per line.');
        }
        const err_msg = 'Invalid points. Must be two numbers per line, separated by a comma.';
        let lines = data.split(/\r?\n|\r|\n/g).map(x => x.trim());
        console.log('lines =', lines);
        lines = lines.filter(x => {
            return x.length && x.includes(',');
        });
        const problem_context = getProblemContext();
        const points_remaining = problem_context['points_remaining'];
        if (lines.length > points_remaining) {
            throw new Error(`Too many points. You have only ${points_remaining} remaining.`);
        }
        return lines.map(x => {
            vals = x.split(',');
            if (vals.length !== 2) { throw new Error(err_msg); }
            vals = vals.map(v => parseFloat(v.trim()));
            if (vals.reduce((p, n) => { return p || !isFloat(n);}, false)) {
                console.log('this error');
                throw new Error(err_msg);
            }
            return vals;
        });
    },

    addRequest: () => {
        try {
            console.log('[NewRequest.addRequest]');
            let textarea = document.getElementById('input-data');
            data = textarea.value;
            problem_id = state['problem_selector']['selected_id']
            points_to_add = NewRequest.parseInput(data);
            if (points_to_add.length == 0) {
                throw new Error('Invalid input. No points specified.');
            }
            console.log('points_to_add =', points_to_add);
            state['new_request']['fetching'] = true;
            fetchAddRequest(state['user']['id'], problem_id, points_to_add, NewRequest.onAddSuccess, NewRequest.onAddFailure);
            NewRequest.renderError();
        } catch (err) {
            state['new_request']['fetching'] = false;
            state['new_request']['msg'] = err;
            NewRequest.renderError();
        }
    },

    onAddSuccess: (data) => {
        console.log('[onAddSuccess]', data);
        state['new_request']['fetching'] = false;
        state['new_request']['msg'] = '';
        state['points'].push(...data['points']);
        state['requests'].push(data['request']);
        NewRequest.render();
        RequestsTable.render();
    },

    onAddFailure: (err) => {
        console.log('[onAddFailure]', err);
        state['new_request']['fetching'] = false;
        state['new_request']['msg'] = err;
        NewRequest.renderError();
    },

    renderError: () => {
        if (state['new_request']['fetching']) {
            new_request_error.textContent = 'Adding points...';
            return;
        }
        new_request_error.textContent = state['new_request']['msg'];
    },

    hasRequestsRemaining: () => {
        let problem_id = state['problem_selector']['selected_id'];
        if (problem_id === null) return true;
        let problem = state['problems'].find((x) => {
            return x.id === problem_id
        });
        used_requests = state['requests'].reduce((prev, next) => {
            if (next.problem_id === problem_id) {
                return prev + 1;
            }
            return prev;
        }, 0);
        return problem.max_requests - used_requests > 0;
    },

    hasPointsRemaining: () => {
        let problem_id = state['problem_selector']['selected_id'];
        let problem = state['problems'].find((x) => {
            return x.id === problem_id
        });
        let request_ids = state['requests'].reduce((prev, next) => {
            if (next.problem_id === problem_id) {
                prev.push(next.id);
            }
            return prev;
        }, []);
        console.log('request_ids =', request_ids);
        let used_points = state['points'].reduce((prev, next) => {
            if (request_ids.includes(next.request_id)) {
                return prev + 1;
            }
            return prev;
        }, 0);
        console.log('used points =', used_points);
        return problem.max_points - used_points > 0;
    },

    render: () => {
        console.log('[NewRequest.render]');
        let children = [];
        data = getProblemContext();
        if (isLoggedIn() && data['requests_remaining'] > 0 && data['points_remaining'] > 0) {
            let textarea = document.createElement('textarea');
            textarea.setAttribute('id', 'input-data');
            textarea.setAttribute('rows', 10);
            textarea.setAttribute('cols', 24);
            let p = document.createElement('p');
            p.textContent = 'Enter one point per line as x,y. '
            let a = document.createElement('a');
            a.setAttribute('href', '#');
            a.textContent = 'Show an example.';
            a.addEventListener('click', () => {
                textarea.value = '1.345,-2.345\n0.346,9.231\n-1.205,-3.482'; 
            });
            p.append(a);
            let button = document.createElement('button');
            button.textContent = 'Add points';
            button.addEventListener('click', NewRequest.addRequest);
            let br = document.createElement('br');
            children = [p, textarea, br, button];
        }
        new_request_main.replaceChildren(...children);
        NewRequest.renderError();
    }
};

const App = {
    render: () => {
        console.log('App.render');
        Login.render();
        ProblemSelector.render();
        RequestsTable.render();
        NewRequest.render();
    }
};

window.onload = function() {
    configureFetch();
    resetState();
    if (state['user']) {
        fetchInfo(state['user']['id'], (data) => {
            state = {...state, ...data};
            console.log('state =', JSON.stringify(state));
            App.render();
        }, (err) => {
            User.remove();
            state['user'] = null;
        })
    };
    App.render();
};
