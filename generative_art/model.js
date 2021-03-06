/* 
    Trees as Stochastic Lindenmayer Systems
    (and Inference over them!)

    Author: Ameya Daigavane
*/

// globalStore variables that WebPPL will pass back when run() in loader.js exits.
globalStore.curr_line = 0;
globalStore.statement = SLS.axiom;
globalStore.inferred_depth = 0;
globalStore.actual_leaves = 0;

// Graphical parameters.
let svg = d3.select("svg");
let box_width = svg.attr("width");
let box_height = svg.attr("height");

// Tree parameters.
let start_width = 6;
let start_length = 15;
let start_pos = [box_width / 2, 5 * box_height / 5];
let start_angle = -Math.PI / 2;

// Performs an action based on the character passed.
let perform_action = function(index, pos, angle, length, width){
     
    let ch = globalStore.statement.charAt(index);
    if(ch == 'F'){
        if (length > 2){
            // New position, as we move forward.
            let new_x = pos[0] + length * Math.cos(angle);
            let new_y = pos[1] + length * Math.sin(angle);
            let new_pos = [new_x, new_y];
        
            // Draw the branch.
            draw_line(pos[0], pos[1], new_pos[0], new_pos[1], width, "brown");

            let new_length = (width > 0.5 * start_width) ? length : length * uniform(0.9, 1);
            let new_width = (width < 0.2 * start_width) ? width : width * uniform(0.8, 1);

            // Go to the next character.
            if(index < globalStore.statement.length - 1){
                return perform_action(index + 1, new_pos, angle, new_length, new_width);
            }
        } else {
            return perform_action(index + 1, pos, angle, length, width);
        }

        return;
    } 

    if (ch == 'L') {
        // New position, as we move forward.
        let new_x = pos[0] + length * Math.cos(angle);
        let new_y = pos[1] + length * Math.sin(angle);
        let new_pos = [new_x, new_y];
    
        // Draw the leaf.
        draw_line(pos[0], pos[1], new_pos[0], new_pos[1], 2*width/3, "green");

        // Go to the next character.
        if (index < globalStore.statement.length - 1) {
            return perform_action(index + 1, new_pos, angle, length, 2*width/3);
        }
    
        return;
    } 

    if (ch == 'X') {
        // No action for X.
        if (index < globalStore.statement.length - 1) {
            return perform_action(index + 1, pos, angle, length, width);
        }
        return;
    } 

    if (ch == '['){
        // Save current parameters. 
        // We do this by reading upto the next ']' and then continuing from there with these parameters.
        if (index < globalStore.statement.length - 1) {
            let new_index = perform_action(index + 1, pos, angle, length, width);
            return perform_action(new_index, pos, angle, length, width);
        }
        return;
    }

    if (ch == ']'){
        // Restore old parameters, by returning from here upto the first previous '['.
        if (index < globalStore.statement.length - 1) {
            return index + 1;
        }
        return;
    }

    if (ch == '+') {
        // Turn right by a random angle.
        if (index < globalStore.statement.length - 1) {
            let new_angle = angle + uniform(Math.PI/20, Math.PI/7);
            return perform_action(index + 1, pos, new_angle, length, width);
        }
        return;
    } 

    if (ch == '-') {
        // Turn left by a random angle.
        if (index < globalStore.statement.length - 1) {
            let new_angle = angle - uniform(Math.PI/20, Math.PI/7);
            return perform_action(index + 1, pos, new_angle, length, width);
        }
        return;
    } 
}

// Draw the tree recursively using globalStore.statement as a guide.
let draw_tree = function(){
    perform_action(0, start_pos, start_angle, start_length, start_width);
}

// Draw a line from position (x1, y1) to (x2, y2) with the given parameters.
let draw_line = function (x1, y1, x2, y2, width, colour) {
    svg.append("line")
        .attr("class", "tree")
        .attr("x1", x1)
        .attr("y1", y1)
        .attr("x2", x2)
        .attr("y2", y2)
        .style("stroke", colour)
        .style("stroke-width", width)
        .style("stroke-opacity", 0)
        .transition()
        .delay(10 * globalStore.curr_line)
        .style("stroke-opacity", 1);

    globalStore.curr_line += 1;
}

// Applying the L-system rules once over a given string.
let make_next_statement = function (str) {
    let char_choices = map(SLS_apply_helper, str);
    let char_array = map(get_sample, char_choices);
    return reduce(function (curr, next) { return curr + next; }, "", char_array);
}

// Helper because WebPPL won't allow JS functions directly as an argument to map().
let SLS_apply_helper = function (ch) {
    return SLS.apply(ch);
}

// Returns a choice from choice, uniformly picked.
let get_sample = function (choices) {
    return categorical({ vs: choices });
}

// Construct the statement by applying the stochastic L-system rules on a string, until the given depth.
let get_statement = function(str, depth){
    if(depth == 0){
        return str;
    } else {
        get_statement(make_next_statement(str), depth - 1);
    }
}

// Try to estimate depth from the number of leaves, via inference.
let model_tree_params = function () {

    // Prior beliefs.
    let depth = randomInteger(7);

    // Number of leaves in a statement of this depth.
    // let statement = get_statement("A", depth);
    let num_leaves = reduce(function (next, curr) { return (next == 'B') ? (curr + 1) : curr; }, 0, get_statement("A", depth));

    // Condition on actual number of leaves.
    factor(-Math.abs(num_leaves - globalStore.actual_leaves)/100);

    return depth;
};

// Execution starts here.
display("Chosen depth: " + depth);

// Construct the L-system statement starting from the SLS axiom.
globalStore.statement = get_statement(SLS.axiom, depth);

// Compute the number of leaves.
globalStore.actual_leaves = reduce(function (next, curr) { return (next == 'L') ? (curr + 1) : curr; }, 0, globalStore.statement);

// Draw the tree with the L-systsem statement as the guide.
draw_tree();
display(globalStore.actual_leaves);

// Distribution of depth over observed leaves. 
let dist = Infer({ method: 'MCMC', samples: 5000 }, model_tree_params);
display(mapN(function (val) { return Math.exp(dist.score(val)); }, 7));
display(expectation(dist));
display(dist.MAP().val);
globalStore.inferred_depth = dist.MAP().val;

display("Inferred depth: " + globalStore.inferred_depth);

