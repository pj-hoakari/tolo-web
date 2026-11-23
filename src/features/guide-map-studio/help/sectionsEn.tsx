import { B, K, type Section } from "./helpParts";

// 使い方（Q&A）の英語版（日本語版と同じ並び・同じ内容）
export const SECTIONS_EN: Section[] = [
  {
    title: "Getting started",
    items: [
      {
        q: "Where do I start?",
        a: (
          <>
            You build a map by <B>laying out rooms</B>. Go in this order:
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>
                Choose the <B>Room</B> tool and <B>drag</B> on the map to place
                rooms and shops.
              </li>
              <li>
                Type a <B>Name</B> on the right, such as “Reception” or “Room
                101”. Named places become visitors’ <B>destinations</B>.
              </li>
              <li>
                The <B>gaps between rooms are the paths</B> visitors walk. Leave
                enough space for people to pass.
              </li>
              <li>
                In a building with floors, place stairs and elevators with the{" "}
                <B>Stairs/EV</B> tool to connect the floors.
              </li>
              <li>
                When you’re done, press <B>Export</B>. If there are problems,
                such as places that can’t be reached, it tells you first.
              </li>
            </ol>
            <span className="mt-2 block">
              To see a finished example, press <B>Start from the sample</B> in
              the middle of a blank map, or <B>Open the sample</B> under{" "}
              <B>File</B> at the top, to show the KCG main building (1F–6F). If
              you have a map in progress, it opens in a new tab, so your map
              isn’t lost.
            </span>
          </>
        ),
        keywords: "start begin how to steps sample template",
      },
      {
        q: "Is my map saved?",
        a: (
          <>
            Yes. It is <B>saved automatically</B> in this browser. To continue
            on another computer, share it with someone, or publish it on the
            visitor guide screen, save it as a file with <B>Export</B>. You can
            open that file with <B>Import</B> under <B>File</B>.
          </>
        ),
        keywords: "save export import file",
      },
      {
        q: "I want to make two versions and pick the better one (tabs, New)",
        a: (
          <>
            Choose <B>New</B> under <B>File</B> at the top or press <B>+</B>{" "}
            next to the tabs, then choose <B>Building (with floors)</B> or{" "}
            <B>Site (no floors)</B> to open a blank map in a new tab (your
            current map stays). Switch between them by clicking the tabs, like
            sheets in Excel. To base a new version on the current map,{" "}
            <B>right-click the tab → Duplicate</B>. <B>Double-click</B> a tab to
            rename it and <B>drag</B> to reorder. Undo (<K>⌘</K>+<K>Z</K>) is
            separate for each tab.
          </>
        ),
        keywords: "tabs sheets new version duplicate page",
      },
      {
        q: "I want to make a site without floors (outdoors, etc.)",
        a: (
          <>
            Press <B>Make a site without floors</B> in the middle of a blank
            map, or choose <B>Site (no floors)</B> in <B>New</B> under{" "}
            <B>File</B>, to start with a single floor named “Site”. You don’t
            need stairs or elevators. On the visitors’ screen, “Site” appears
            where the floor name goes. Rename it in the “Floor” section on the
            right (shown when nothing is selected), or double-click the floor
            tab. If you later want to map inside a building, add floors with{" "}
            <B>+</B> on the floor tabs.
          </>
        ),
        keywords: "no floors outdoor site festival plaza single new",
      },
      {
        q: "With two or more tabs, which one is exported?",
        a: (
          <>
            When you press <B>Export</B>, you are asked which tab’s map to
            export, and only that one is saved as a file (the tab name is
            included in the file name). With only one tab, it exports right away
            without asking.
          </>
        ),
        keywords: "export tab choose which file",
      },
      {
        q: "What will visitors see?",
        a: (
          <>
            Press <B>Preview</B> in the bar above the map to see it as visitors
            do. Tapping a place with a description shows it. The grid and
            selection outlines are not shown to visitors. If the grid lines get
            in the way while you work, turn them off with the button left of the
            ruler in the bar below the map. Press “Edit” to go back.
          </>
        ),
        keywords: "visitors preview grid lines hide",
      },
    ],
  },
  {
    title: "Placing & writing",
    items: [
      {
        q: "I want more room for the map",
        a: (
          <>
            Hide the side panel with the <B>{"\\"}</B> key (or the button at its
            top right); press again to show it. The side panel has{" "}
            <B>Settings</B> and <B>Guidance</B> tabs, and switches to Settings
            when you select something on the map.
          </>
        ),
        keywords: "more room bigger side panel hide tabs guidance",
      },
      {
        q: "Where are the tools? Where do I set names and colors?",
        a: (
          <>
            The <B>tools</B> are stacked just left of the map (Room, Zone,
            Marker, etc.). Hover to see how to use each. You can also pick them
            with keys (<K>V</K> Select, <K>R</K> Room, <K>C</K> Round room,{" "}
            <K>P</K> Marker, <K>A</K> Zone, <K>T</K> Text, <K>E</K> Stairs/EV).
            Select something you drew and its <B>name</B> and <B>color</B>{" "}
            appear at the top of the settings on the right. Below them, open the
            folded <B>Use as stairs / elevator</B> and{" "}
            <B>Copy to another floor</B> sections when you need them. Position,
            shape and lock are under <B>Advanced settings</B>.
          </>
        ),
        keywords: "tools where name color settings advanced keys",
      },
      {
        q: "How do I place rooms or shops?",
        a: (
          <>
            Choose the <B>Room</B> tool (or <B>Round room</B> for round ones)
            and <B>drag</B> on the map to place it at that size. A single click
            places it at a default size. The{" "}
            <B>gaps between rooms are the walkways</B> used for directions.
            Places that aren’t rooms (entrances, info desks, etc.) can be placed
            with <B>Marker</B>.
          </>
        ),
        keywords: "rectangle circle room shop place add",
      },
      {
        q: "How do I add a name or description?",
        a: (
          <>
            Click something you placed and its settings appear on the right. You
            can enter a <B>Name</B> and <B>Description</B>. A description is
            shown only if you write one, when visitors tap the place.
          </>
        ),
        keywords: "name title description",
      },
      {
        q: "How do I change the color?",
        a: (
          <>
            Select it and press a <B>color</B> under the tools on the left of
            the map, or a color in the settings on the right. You can also use
            the right-click menu. If several things are selected, they all
            change.
          </>
        ),
        keywords: "color",
      },
      {
        q: "What is a zone, and how do I draw one?",
        a: (
          <>
            A zone outlines a region to make it easy to see, like a “merch
            queue” (it is drawn underneath everything). Choose the <B>Zone</B>{" "}
            tool and drag to draw a rectangular region. Drag a corner point to
            resize it; the edges connected to that corner move with it.
          </>
        ),
        keywords: "area region queue",
      },
      {
        q: "How do I block a way (close it)?",
        a: (
          <>
            Draw a zone over the place you want to block and turn on{" "}
            <B>Closed</B> in its settings. Directions will take a way around it.
          </>
        ),
        keywords: "closed block congestion avoid",
      },
      {
        q: "How do I delete something?",
        a: (
          <>
            Select it and press <K>Delete</K>, or right-click → “Delete”. If you
            make a mistake, undo with <K>⌘</K>+<K>Z</K>.
          </>
        ),
        keywords: "delete remove",
      },
    ],
  },
  {
    title: "Selecting & moving",
    items: [
      {
        q: "How do I select several things?",
        a: (
          <>
            <B>Drag</B> from an empty spot to draw a box around them, or hold{" "}
            <K>Shift</K> and click (click again to remove). <K>⌘</K>+<K>A</K>{" "}
            selects everything on the floor.
          </>
        ),
        keywords: "several select multiple shift",
      },
      {
        q: "How do I move things, or several at once?",
        a: (
          <>
            Drag to move. If several are selected, dragging one moves them all.
            The arrow keys nudge them too (<K>Shift</K> for bigger steps).
          </>
        ),
        keywords: "move drag arrow",
      },
      {
        q: "How do I move or zoom the map itself?",
        a: (
          <>
            Hold <K>⌘</K> (or <K>Space</K>) and drag to grab and move the map.
            Zoom with <K>⌘</K>+mouse wheel, or the + / − buttons in the bar
            below the map.
          </>
        ),
        keywords: "map move zoom",
      },
      {
        q: "How do I deselect?",
        a: (
          <>
            Click an empty spot or outside the map. <K>Esc</K> also clears the
            selection (even while typing a name in the settings on the right).
            You can also press <B>Deselect</B> next to the heading of the
            settings.
          </>
        ),
        keywords: "deselect clear",
      },
      {
        q: "How do I find a place by name?",
        a: (
          <>
            Type in <B>Find by name</B> to the right of the floor tabs (or press{" "}
            <K>⌘</K>+<K>F</K>). Press a result to switch to that floor and bring
            the place to the center.
          </>
        ),
        keywords: "find search name",
      },
      {
        q: "I want to check or fix room names all at once (list)",
        a: (
          <>
            Press <B>List</B> under <B>More</B> at the top to see rooms,
            markers, stairs, elevators and more in a table (zones have no names,
            so they aren’t listed). You can edit names and colors right there,
            filter by floor or name, or show only items without a name. Press{" "}
            <B>Show</B> to go to that place.
          </>
        ),
        keywords: "list table names edit check all",
      },
      {
        q: "On a large site I can’t tell where I am (overview map)",
        a: (
          <>
            The <B>overview map</B> at the bottom right of the map (shown when
            the map doesn’t fit) shows the whole floor and the area you’re
            viewing (frame). Press or drag on it to move there. Show or hide it
            with the map button in the bar below the map.
          </>
        ),
        keywords: "overview minimap where lost navigate",
      },
      {
        q: "How do I lock something so it doesn’t move?",
        a: (
          <>
            Select it and press <B>Lock</B> in the settings on the right (also
            in the right-click menu). Locked things can’t be dragged or deleted.
            Locking large areas or walls keeps you from moving them by mistake
            while working on things on top. Press it again to <B>Unlock</B>.
          </>
        ),
        keywords: "lock fixed prevent moving",
      },
    ],
  },
  {
    title: "Size & alignment",
    items: [
      {
        q: "How do I resize?",
        a: (
          <>
            When selected, small squares appear on the corners. Drag them to
            make it taller or wider. Stairs and elevator marks work the same
            way.
          </>
        ),
        keywords: "size resize corner",
      },
      {
        q: "How do I line things up neatly?",
        a: (
          <>
            When you move or resize, it snaps where{" "}
            <B>edges or centers line up</B> with other things, where the{" "}
            <B>size matches</B>, or where the <B>gaps are equal</B>, and shows
            lines and numbers.
          </>
        ),
        keywords: "align snap equal spacing lines numbers",
      },
      {
        q: "How do I make several the same size or evenly spaced?",
        a: (
          <>
            For the same size, select them and press “Same width”, “Same height”
            or “Same size” on the right. For even spacing, move or resize until{" "}
            <B>two matching numbers</B> appear in the gaps, then let go.
          </>
        ),
        keywords: "same size even spacing",
      },
    ],
  },
  {
    title: "Floors, stairs & elevators",
    items: [
      {
        q: "How do I add, rename or delete floors?",
        a: (
          <>
            Add floors with <B>+</B> next to the floor tabs. <B>Double-click</B>{" "}
            a tab to rename it. <B>Right-click</B> a tab for “Rename / Duplicate
            / Delete / Move left / Move right”. You can also reorder tabs by{" "}
            <B>dragging</B>.
          </>
        ),
        keywords: "floor add rename delete duplicate reorder",
      },
      {
        q: "I want to check or set positions with numbers (coordinates, rulers)",
        a: (
          <>
            The <B>rulers</B> on the top and left of the map show map
            coordinates (0 at the top left). The mouse position appears in the
            bar below the map like “X 240 Y 360”, and the size (W, H) while you
            draw a room. The selected item’s range shows as a colored band on
            the rulers. Enter numbers in <B>X, Y, W, H</B> in the settings on
            the right to set the exact position and size (X, Y are the top-left
            corner). To match a position on another floor, enter the same
            numbers. Show or hide the rulers with the ruler button in the bar
            below the map.
          </>
        ),
        keywords: "coordinates ruler position numbers x y width height align",
      },
      {
        q: "How do I copy things from 1F to 2F?",
        a: (
          <>
            Select them and right-click → “Copy to 2F”, or open “Copy to another
            floor” on the right and press a floor. They are copied to the{" "}
            <B>same position</B>. You can also copy with <K>⌘</K>+<K>C</K>, open
            2F and paste with <K>⌘</K>+<K>V</K>.
          </>
        ),
        keywords: "copy another floor paste",
      },
      {
        q: "How do I place stairs, elevators or escalators?",
        a: (
          <>
            Choose the <B>Stairs/EV</B> tool, pick the type (stairs, escalator
            or elevator) and click the map. It is placed at{" "}
            <B>the same spot on every floor</B>, and moving it on one floor
            moves it on all floors.
          </>
        ),
        keywords: "stairs elevator escalator place",
      },
      {
        q: "I want to turn a room I drew into an elevator",
        a: (
          <>
            Select the room and press “Make it Elevator” (or Stairs / Escalator)
            on the right.
          </>
        ),
        keywords: "rectangle elevator convert",
      },
    ],
  },
  {
    title: "Crowd-avoiding guidance",
    items: [
      {
        q: "How are visitors guided on their screen?",
        a: (
          <>
            Visitors are guided from their <B>current location</B> (where they
            scanned the QR code) to the <B>destination</B> they search for.
            Using the site’s <B>crowd info</B>, the route{" "}
            <B>avoids crowded spots</B> and never passes dangerous ones. When
            crowds change, the route changes too. In the studio, try the same
            calculation with <B>Crowd-avoiding guidance (preview)</B> on the
            right.
          </>
        ),
        keywords:
          "visitors guidance crowd avoid current location destination qr",
      },
      {
        q: "How do I try crowd-avoiding guidance?",
        a: (
          <>
            In <B>Crowd-avoiding guidance (preview)</B> on the right, choose the
            current location and destination. Then in <B>Try congestion</B>,
            pick a level (medium/high/danger), then press cells in the{" "}
            <B>stairs & elevators table</B> to crowd that car on that floor
            (press a car’s name for all its floors, or a floor for every car on
            it). The crowd-avoiding route (orange) and the route without crowds
            (gray dotted) appear on the map, and crowded spots are colored.{" "}
            <B>Reset</B> clears the destination and trials (the current location
            stays, since it’s saved in the map).
          </>
        ),
        keywords: "crowd try preview avoid route reset",
      },
      {
        q: "How do I make crowds avoidable? (links)",
        a: (
          <>
            The visitors’ screen receives crowd info{" "}
            <B>per graph point/route</B>. If places and zones on the map{" "}
            <B>aren’t linked</B> to them, crowds there <B>can’t be avoided</B>.
            Draw <B>everything</B> on the map (rooms, zones, text), but the
            graph (the guidance graph made in the graph editor) only needs{" "}
            <B>stairs, elevators, escalators and corridors</B>, plus places
            where queues or crowds are measured. Rooms can be destinations by
            their map names alone, so they don’t need links. The graph is loaded
            when you open the studio, and floors, stairs, elevators and so on{" "}
            <B>link automatically to points with the same name</B> (even if a
            floor has two points with the same name, they are worked out from
            the other floors). Only for items that couldn’t be linked
            automatically, open <B>Links</B> (under <B>More</B> at the top),
            select something on the map, and press “Link to selected”. For
            corridors, draw a <B>zone</B> along the passage and link it to a
            route. <B>Check</B> also lists stairs and elevators that aren’t
            linked.
          </>
        ),
        keywords:
          "links graph guidance point route crowd avoid corridor stairs elevator room",
      },
    ],
  },
  {
    title: "Finishing & sharing",
    items: [
      {
        q: "I want to check for mistakes before showing it to visitors",
        a: (
          <>
            Press <B>Check</B> at the top to list <B>unreachable places</B>,{" "}
            <B>stairs not linked to other floors</B>,{" "}
            <B>floors with no stairs or elevator</B>,{" "}
            <B>places without names</B>,{" "}
            <B>overlapping rooms, stairs and elevators</B> and more. Items come
            in three levels, each with its own color (red = <B>Fix this</B>,
            yellow = <B>Please check</B>, blue = <B>FYI</B>). Press{" "}
            <B>Show the place</B> to highlight the spot on the map, with a note
            saying what’s wrong. If something is on purpose (rooms you
            overlapped, for example), press <B>OK</B> to hide it; restore it
            later from “Items marked OK” at the bottom of the list.{" "}
            <B>Export</B> also checks automatically and shows the list only when
            something is red or yellow (you can still choose “Export anyway”).
            While anything is red or yellow, the <B>Check</B> button shows how
            many.
          </>
        ),
        keywords:
          "check mistakes unreachable before export overlap ok hide highlight",
      },
      {
        q: "I want the map as an image / on paper",
        a: (
          <>
            Under <B>Save image</B> in <B>File</B>, choose{" "}
            <B>This floor only</B> or <B>All floors</B> (one PNG per floor),
            handy for documents. For all floors, if the browser asks about
            downloading multiple files, choose “Allow”. <B>Print</B> prints
            every floor, one per page. Choose “Save as PDF” in the print dialog
            to make a PDF.
          </>
        ),
        keywords: "image png print pdf paper",
      },
    ],
  },
  {
    title: "Troubleshooting",
    items: [
      {
        q: "My map disappeared / I want to continue on another computer",
        a: (
          <>
            The map is saved <B>only in this browser on this computer</B>. It
            isn’t visible on another computer, another browser or a private
            window, and clearing the browser’s history or data deletes it too.
            Press <B>Export</B> now and then to save a file, and open it with{" "}
            <B>Import</B> under <B>File</B> to continue.
          </>
        ),
        keywords: "disappeared lost save another computer backup export",
      },
      {
        q: "“Open the sample” or “Import” added a tab",
        a: (
          <>
            <B>Open the sample</B> and <B>Import</B> open in a <B>new tab</B> if
            the current tab has anything on it, so your work isn’t lost (a blank
            tab is used as is). Remove tabs you don’t need with{" "}
            <B>right-click → Delete</B>.
          </>
        ),
        keywords: "sample import replaced tab added new tab",
      },
      {
        q: "I deleted a tab by mistake",
        a: (
          <>
            Right after deleting, press <B>Undo</B> at the bottom of the screen
            to put it back (it disappears after about 8 seconds). <K>⌘</K>+
            <K>Z</K> doesn’t bring tabs back, so also save important versions
            with <B>Export</B>.
          </>
        ),
        keywords: "tab deleted lost undo",
      },
      {
        q: "It won’t move / can’t be deleted",
        a: (
          <>
            Things with a lock mark at the top right are <B>locked</B>. Select
            it and press <B>Locked (press to unlock)</B> in the settings on the
            right.
          </>
        ),
        keywords: "won't move cannot delete locked",
      },
      {
        q: "The preview says “No route found”",
        a: (
          <ul className="list-disc space-y-1 pl-4">
            <li>
              If the <B>gaps between shapes are too narrow</B>, no one can pass.
              Leave at least one small grid square between them.
            </li>
            <li>Check that no room or “Closed” zone blocks the passage.</li>
            <li>
              If a zone surrounds both the start and the destination, directions{" "}
              <B>never leave that zone</B>. Draw the zone big enough to cover
              the whole building.
            </li>
            <li>
              Across floors, check that the floor has stairs or an elevator (not
              “Not linked”) and that escalators run the right way.
            </li>
          </ul>
        ),
        keywords: "no route found cannot pass directions",
      },
      {
        q: "A room doesn’t appear in the current location / destination list",
        a: (
          <>
            Only <B>named places</B> appear (same as the visitors’ screen).
            Select the room and enter a name on the right. If it’s linked to a
            graph point, the point’s name is used. Stairs and elevators don’t
            appear.
          </>
        ),
        keywords: "list missing current location destination name",
      },
      {
        q: "Dragging draws a box instead of moving the map",
        a: (
          <>
            Dragging on an empty spot selects several things. To move the map,
            hold <K>⌘</K> (or <K>Space</K>) while dragging.
          </>
        ),
        keywords: "box drag map not moving",
      },
      {
        q: "I lost the map / it got too small",
        a: (
          <>
            Press <B>Fit to view</B> (the four-arrow button) in the bar below
            the map to fit the whole floor. Press the percentage (such as
            “100%”) to return to normal size.
          </>
        ),
        keywords: "lost small zoom reset 100% fit view",
      },
      {
        q: "I want to keep the state before trying an idea (save points)",
        a: (
          <>
            Choose <B>Save points</B> under <B>File</B> at the top, enter a name
            (e.g. “Plan A”, “before widening the entrance”) and press{" "}
            <B>Save current state</B>. <K>⌘</K>+<K>S</K> saves right away
            without a name; you can name it later by clicking its name (pencil
            icon) in the list. Save points are kept per tab and remain after
            reopening the page (in this browser only).
          </>
        ),
        keywords: "save point snapshot history keep ⌘S version",
      },
      {
        q: "I want to go back to a save point / delete save points",
        a: (
          <>
            Open <B>Save points</B> and press <B>Restore</B> on the one you
            want; a confirmation appears. To keep your current map too, choose{" "}
            <B>Save, then restore</B>; otherwise <B>Restore without saving</B>{" "}
            (right after, ⌘Z also undoes it). To compare while keeping your
            current map, use <B>Open in new tab</B>. Delete save points you
            don’t need with the trash button → <B>Delete</B> (this can’t be
            undone).
          </>
        ),
        keywords: "save point restore earlier state reopen delete history",
      },
      {
        q: "I can’t put it exactly where I want (it snaps)",
        a: (
          <>
            Things snap where they line up with others and to the grid steps. As
            in PowerPoint, hold <K>Alt</K> (<K>Option</K>) while moving,
            resizing, drawing or placing to put things exactly where you want.
            With <K>Alt</K>, the arrow keys move 1px at a time.
          </>
        ),
        keywords: "snap stuck position option alt free exact fine",
      },
      {
        q: "⌘Z (undo) doesn’t work",
        a: (
          <>
            While you’re typing in a name or description field, it undoes your
            typing instead. Click an empty spot on the map first. After
            reloading the page ⌘Z can’t go back, so create a <B>save point</B> (
            <K>⌘</K>+<K>S</K>) at important moments to return to later.
          </>
        ),
        keywords: "undo not working",
      },
      {
        q: "I can’t select things inside a zone / the zone itself",
        a: (
          <>
            Things placed inside a zone can be clicked as usual. To select the
            zone itself, click an empty spot inside it, or its outline (dragging
            selects several things instead).
          </>
        ),
        keywords: "area cannot select",
      },
      {
        q: "Deleting stairs removed them from other floors too",
        a: (
          <>
            Stairs and elevators are treated as one thing across all floors. To
            remove one from a single floor, don’t delete it; uncheck that floor
            in “Connected floors” on the right.
          </>
        ),
        keywords: "stairs deleted other floors connected",
      },
      {
        q: "The escalator is guided the wrong way",
        a: (
          <>
            Up and down are based on{" "}
            <B>
              the floor tabs: left is the lower floor, right is the upper floor
            </B>
            . Put the tabs in order (1F → 2F → 3F) and check “Direction” in the
            escalator settings.
          </>
        ),
        keywords: "escalator wrong direction up down",
      },
      {
        q: "Room names stay in Japanese after switching to English",
        a: (
          <>
            Only the buttons and explanations switch. Room and floor names are
            shown exactly as you typed them.
          </>
        ),
        keywords: "english names japanese language",
      },
    ],
  },
  {
    title: "Keyboard",
    items: [
      {
        q: "List of keyboard shortcuts",
        a: (
          <ul className="space-y-1">
            <li>
              <K>⌘</K>+<K>Z</K> Undo / <K>⌘</K>+<K>Shift</K>+<K>Z</K> Redo
            </li>
            <li>
              <K>⌘</K>+<K>C</K> Copy / <K>⌘</K>+<K>V</K> Paste / <K>⌘</K>+
              <K>X</K> Cut
            </li>
            <li>
              <K>⌘</K>+<K>D</K> Duplicate / <K>⌘</K>+<K>A</K> Select all on this
              floor
            </li>
            <li>
              <K>Delete</K> Delete / <K>Esc</K> Deselect / Arrow keys: nudge
            </li>
            <li>
              Hold <K>⌘</K> or <K>Space</K> and drag: move the map
            </li>
            <li>
              <K>Shift</K>+click: add to selection / <K>Alt</K> (<K>Option</K>
              )+drag, draw or place: no snapping / <K>Alt</K>+arrows: move 1px
            </li>
            <li>
              <K>⌘</K>+<K>F</K> Find by name / <K>⌘</K>+<K>S</K> Create a save
              point
            </li>
            <li>
              <K>V</K> Select / <K>R</K> Room / <K>C</K> Round room / <K>P</K>{" "}
              Marker / <K>A</K> Zone / <K>T</K> Text / <K>E</K> Stairs/EV
            </li>
          </ul>
        ),
        keywords: "keyboard shortcuts undo copy paste",
      },
    ],
  },
];
