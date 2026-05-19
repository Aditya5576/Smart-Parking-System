#include <iostream>
#include <string>
#include <queue>
#include <vector>
#include <sstream>

using namespace std;

// Structure to hold slot data
struct Slot {
    string id;
    int distance;

    // We want a Min Heap based on distance, so we overload the > operator
    // The priority queue returns the largest element by default, 
    // so returning true when this > other means smaller distances go to the top
    bool operator>(const Slot& other) const {
        return distance > other.distance;
    }
};

int main(int argc, char* argv[]) {
    // Priority queue to act as our Min Heap
    priority_queue<Slot, vector<Slot>, greater<Slot>> minHeap;

    // Node.js will pass arguments in the format: SlotID:Distance
    // Example: allocator.exe A1:10 B2:5 C1:20
    for (int i = 1; i < argc; ++i) {
        string arg = argv[i];
        
        // Find the delimiter ":"
        size_t colonPos = arg.find(':');
        if (colonPos != string::npos) {
            string id = arg.substr(0, colonPos);
            int distance = stoi(arg.substr(colonPos + 1));
            
            // Push into Min Heap (O(log N) complexity)
            minHeap.push({id, distance});
        }
    }

    // If there are no free slots parsed, return an error identifier
    if (minHeap.empty()) {
        cout << "NONE" << endl;
        return 1;
    }

    // The top element is guaranteed to be the nearest slot (smallest distance)
    Slot bestSlot = minHeap.top();
    
    // Print the best slot ID to standard output so Node.js can read it via IPC
    cout << bestSlot.id << endl;

    return 0;
}
